#!/usr/bin/env python3
"""
Bulk-refresh all reels in Supabase via the VM cache endpoint.

Strategy:
  1. GET /api/reel-info?url=<url>  → returns cached play_count/likes/comments instantly
  2. Write back to Supabase

If a reel isn't in cache (404/not cached), it gets submitted for async scraping via
/api/async/scrape and polled for result.

Usage:
    python3 scripts/bulk_refresh_reels.py             # refresh all
    python3 scripts/bulk_refresh_reels.py --limit 50  # test with 50
    python3 scripts/bulk_refresh_reels.py --concurrency 15
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import threading
from queue import Queue, Empty
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

try:
    from supabase import create_client
    import requests
except ImportError:
    print("Installing deps…")
    os.system(f"{sys.executable} -m pip install --quiet supabase requests")
    from supabase import create_client
    import requests

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
API_SERVER   = "https://instagram-pr-api.onrender.com"

PAGE_SIZE     = 1000
POLL_INTERVAL = 4
MAX_POLL      = 60   # 60 × 4s = 4 min max for async fallback


def fetch_all_reels(sb):
    all_reels = []
    from_ = 0
    while True:
        resp = (
            sb.table("reels")
            .select("id,shortcode,permalink,url,inputurl,videoplaycount,likescount,commentscount")
            .range(from_, from_ + PAGE_SIZE - 1)
            .execute()
        )
        page = resp.data or []
        all_reels.extend(page)
        if len(page) < PAGE_SIZE:
            break
        from_ += PAGE_SIZE
    return all_reels


def get_url(reel: dict) -> str | None:
    for field in ("permalink", "url", "inputurl"):
        v = (reel.get(field) or "").strip()
        if v:
            return v
    sc = reel.get("shortcode")
    if sc:
        return f"https://www.instagram.com/reel/{sc}/"
    return None


def fetch_cached(reel_url: str) -> tuple | None:
    """GET /api/reel-info — returns (play, likes, comments) if cached, else None."""
    try:
        r = requests.get(
            f"{API_SERVER}/api/reel-info",
            params={"url": reel_url},
            timeout=20,
        )
        if not r.ok:
            return None
        d = r.json()
        if not d.get("success") or not d.get("cached"):
            return None
        eng = d.get("engagement") or {}
        play     = eng.get("play_count") or eng.get("view_count") or eng.get("views")
        likes    = eng.get("like_count")
        comments = eng.get("comment_count")
        if play is None:
            return None
        return int(play), (int(likes) if likes is not None else None), (int(comments) if comments is not None else None)
    except Exception:
        return None


def submit_async(reel_url: str) -> str | None:
    """Submit to async scrape, return job_id."""
    try:
        r = requests.post(
            f"{API_SERVER}/api/async/scrape",
            params={"url": reel_url},
            timeout=30,
        )
        if r.ok:
            return r.json().get("job_id")
    except Exception:
        pass
    return None


def poll_async(job_id: str) -> tuple | None:
    """Poll async job. Returns (play, likes, comments) or None."""
    for _ in range(MAX_POLL):
        time.sleep(POLL_INTERVAL)
        try:
            r = requests.get(f"{API_SERVER}/api/async/status/{job_id}", timeout=15)
            if not r.ok:
                continue
            d = r.json()
            if d.get("status") == "completed":
                result = d.get("result") or {}
                data   = result.get("data") or {}
                play = (
                    data.get("play_count") or data.get("playCount") or
                    data.get("video_play_count") or data.get("videoPlayCount") or
                    data.get("view_count")
                )
                likes    = data.get("like_count") or data.get("likeCount") or data.get("likesCount")
                comments = data.get("comment_count") or data.get("commentCount") or data.get("commentsCount")
                if play is not None:
                    return (
                        int(play),
                        int(likes)    if likes    is not None else None,
                        int(comments) if comments is not None else None,
                    )
                return None
            if d.get("status") == "failed":
                return None
        except Exception:
            pass
    return None


def worker(task_q: Queue, counters: dict, sb, lock: threading.Lock):
    while True:
        try:
            reel = task_q.get_nowait()
        except Empty:
            break

        reel_url = get_url(reel)
        if not reel_url:
            with lock:
                counters["skip"] += 1
            task_q.task_done()
            continue

        # Only use cache (fast path — async scrape skipped; tunnel may be down)
        counts = fetch_cached(reel_url)

        if counts is None:
            with lock:
                counters["fail"] += 1
            task_q.task_done()
            continue

        play, likes, comments = counts

        # Never decrease view count
        old_play = reel.get("videoplaycount") or 0
        new_play = max(int(play), int(old_play))

        update = {
            "videoplaycount": new_play,
            "lastupdatedat": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "refresh_failed": False,
        }
        if likes    is not None: update["likescount"]    = likes
        if comments is not None: update["commentscount"] = comments

        try:
            sb.table("reels").update(update).eq("id", reel["id"]).execute()
            with lock:
                counters["ok"]   += 1
                counters["views"] += new_play
        except Exception as e:
            print(f"  ⚠️  DB error {reel['id']}: {e}")
            with lock:
                counters["fail"] += 1

        task_q.task_done()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit",       type=int, default=0,  help="Cap number of reels (0=all)")
    ap.add_argument("--concurrency", type=int, default=15, help="Parallel workers (default 15)")
    args = ap.parse_args()

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("📥 Fetching all reels from Supabase…")
    reels = fetch_all_reels(sb)
    print(f"   Found {len(reels)} reels total")

    if args.limit:
        reels = reels[:args.limit]
        print(f"   Capped to {len(reels)}")

    task_q: Queue = Queue()
    for r in reels:
        task_q.put(r)

    counters = {"ok": 0, "fail": 0, "skip": 0, "views": 0}
    lock = threading.Lock()
    total = len(reels)
    n_workers = min(args.concurrency, total)

    print(f"🚀 Starting with {n_workers} workers…\n")
    start_time = time.time()

    workers = []
    for _ in range(n_workers):
        t = threading.Thread(target=worker, args=(task_q, counters, sb, lock), daemon=True)
        t.start()
        workers.append(t)

    # Progress loop
    while any(t.is_alive() for t in workers):
        time.sleep(15)
        with lock:
            done = counters["ok"] + counters["fail"] + counters["skip"]
            ok   = counters["ok"]
            fail = counters["fail"]
        elapsed = time.time() - start_time
        rate    = done / elapsed * 60 if elapsed > 0 else 0
        eta     = (total - done) / (rate / 60) if rate > 0 else 0
        print(f"  {done}/{total}  ✅{ok} ❌{fail}  {rate:.0f}/min  ETA {eta/60:.1f}min")

    for t in workers:
        t.join()

    elapsed = time.time() - start_time
    print(f"\n🎉 Done in {elapsed/60:.1f} min")
    print(f"   ✅ Refreshed : {counters['ok']}")
    print(f"   ❌ Failed    : {counters['fail']}")
    print(f"   ⏭  Skipped  : {counters['skip']}")
    print(f"   👁  Total views written: {counters['views']:,}")


if __name__ == "__main__":
    main()
