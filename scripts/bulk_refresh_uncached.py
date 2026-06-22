#!/usr/bin/env python3
"""
Refresh ALL reels in Supabase by scraping directly from api.rareme.shop.

Two paths:
  1. Cache hit  → GET  https://api.rareme.shop/reel-info?url=<url>   (instant)
  2. Cache miss → POST https://api.rareme.shop/api/async/scrape       (live scrape)
                  then poll /api/async/status/<job_id>

Writes via Render /api/bulk-update-views (service-role key, bypasses RLS).

Usage:
    python3 scripts/bulk_refresh_uncached.py             # all reels
    python3 scripts/bulk_refresh_uncached.py --limit 50  # test
    python3 scripts/bulk_refresh_uncached.py --concurrency 10
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
    os.system(f"{sys.executable} -m pip install --quiet supabase requests")
    from supabase import create_client
    import requests

SUPABASE_URL  = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY  = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
VM_API        = "https://api.rareme.shop"
RENDER_API    = "https://instagram-pr-api.onrender.com"

PAGE_SIZE     = 1000
WRITE_BATCH   = 50
POLL_INTERVAL = 5     # seconds between status polls
MAX_POLL      = 72    # 72 × 5s = 6 min max


def fetch_all_reels(sb):
    all_reels = []
    from_ = 0
    while True:
        resp = (
            sb.table("reels")
            .select("id,shortcode,permalink,url,inputurl,videoplaycount")
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


def fetch_cached(reel_url: str):
    """Returns (play, likes, comments) from VM cache or None."""
    try:
        r = requests.get(f"{VM_API}/reel-info", params={"url": reel_url}, timeout=15)
        if not r.ok:
            return None
        d = r.json()
        if not d.get("success") or not d.get("cached"):
            return None
        eng      = d.get("engagement") or {}
        play     = eng.get("play_count") or eng.get("view_count") or eng.get("views")
        likes    = eng.get("like_count")
        comments = eng.get("comment_count")
        if play is None:
            return None
        return (
            int(play),
            int(likes)    if likes    is not None else None,
            int(comments) if comments is not None else None,
        )
    except Exception:
        return None


def scrape_live(reel_url: str):
    """Submit async scrape to VM, poll for result. Returns (play, likes, comments) or None."""
    # Submit
    try:
        r = requests.post(f"{VM_API}/api/async/scrape", params={"url": reel_url}, timeout=20)
        if not r.ok:
            return None
        job_id = r.json().get("job_id")
        if not job_id:
            return None
    except Exception:
        return None

    # Poll
    for _ in range(MAX_POLL):
        time.sleep(POLL_INTERVAL)
        try:
            r = requests.get(f"{VM_API}/api/async/status/{job_id}", timeout=15)
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
                likes    = data.get("like_count")    or data.get("likeCount")    or data.get("likesCount")
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
    return None  # timeout


def flush_to_server(batch: list) -> tuple[int, int]:
    if not batch:
        return 0, 0
    try:
        r = requests.post(
            f"{RENDER_API}/api/bulk-update-views",
            json={"updates": batch},
            timeout=30,
        )
        if r.ok:
            d = r.json()
            return d.get("applied", 0), d.get("errors", 0)
        return 0, len(batch)
    except Exception as e:
        print(f"  ⚠️  flush error: {e}")
        return 0, len(batch)


def reader_worker(task_q: Queue, pending_q: Queue, counters: dict, lock: threading.Lock):
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

        # 1) Cache first
        counts = fetch_cached(reel_url)

        # 2) Live scrape fallback
        if counts is None:
            counts = scrape_live(reel_url)

        if counts is None:
            with lock:
                counters["fail"] += 1
            task_q.task_done()
            continue

        play, likes, comments = counts
        old_play = reel.get("videoplaycount") or 0
        new_play = max(int(play), int(old_play))

        update = {"shortcode": reel["shortcode"], "videoplaycount": new_play}
        if likes    is not None: update["likescount"]    = likes
        if comments is not None: update["commentscount"] = comments

        pending_q.put(update)
        with lock:
            counters["fetched"] += 1
        task_q.task_done()


def writer_worker(pending_q: Queue, done_event: threading.Event, counters: dict, lock: threading.Lock):
    buf = []
    while not done_event.is_set() or not pending_q.empty():
        try:
            item = pending_q.get(timeout=3)
            buf.append(item)
            if len(buf) >= WRITE_BATCH:
                applied, errors = flush_to_server(buf)
                with lock:
                    counters["ok"]   += applied
                    counters["fail"] += errors
                buf = []
        except Empty:
            if buf:
                applied, errors = flush_to_server(buf)
                with lock:
                    counters["ok"]   += applied
                    counters["fail"] += errors
                buf = []
    if buf:
        applied, errors = flush_to_server(buf)
        with lock:
            counters["ok"]   += applied
            counters["fail"] += errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit",       type=int, default=0,  help="Cap reels (0=all)")
    ap.add_argument("--concurrency", type=int, default=10, help="Parallel reader workers (default 10)")
    args = ap.parse_args()

    # Verify VM API is reachable
    print("🔍 Checking VM API (api.rareme.shop)…")
    try:
        r = requests.get(f"{VM_API}/health", timeout=10)
        if r.ok:
            print("   ✅ VM API healthy\n")
        else:
            print(f"   ⚠️  VM API returned {r.status_code}\n")
    except Exception as e:
        print(f"   ❌ VM API unreachable: {e}\n")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("📥 Fetching all reels from Supabase…")
    reels = fetch_all_reels(sb)
    print(f"   Found {len(reels)} reels")

    if args.limit:
        reels = reels[:args.limit]
        print(f"   Capped to {len(reels)}")

    task_q: Queue    = Queue()
    pending_q: Queue = Queue()
    for r in reels:
        task_q.put(r)

    counters   = {"ok": 0, "fail": 0, "skip": 0, "fetched": 0}
    lock       = threading.Lock()
    done_event = threading.Event()
    total      = len(reels)
    n_readers  = min(args.concurrency, total)

    print(f"🚀 Starting {n_readers} reader workers + 1 writer…")
    print(f"   Cache hits → instant | Cache miss → live scrape (~30-60s each)\n")
    start_time = time.time()

    # Writer
    wt = threading.Thread(target=writer_worker, args=(pending_q, done_event, counters, lock), daemon=True)
    wt.start()

    # Readers
    readers = []
    for _ in range(n_readers):
        t = threading.Thread(target=reader_worker, args=(task_q, pending_q, counters, lock), daemon=True)
        t.start()
        readers.append(t)

    # Progress
    while any(t.is_alive() for t in readers):
        time.sleep(20)
        with lock:
            done   = counters["fetched"] + counters["fail"] + counters["skip"]
            ok_db  = counters["ok"]
            fail   = counters["fail"]
        elapsed = time.time() - start_time
        rate    = done / elapsed * 60 if elapsed > 0 else 0
        eta     = (total - done) / (rate / 60) if rate > 0 else 0
        print(f"  {done}/{total}  ✅{ok_db} written  ❌{fail} failed  {rate:.0f}/min  ETA {eta/60:.1f}min")

    for t in readers:
        t.join()

    done_event.set()
    wt.join()

    elapsed = time.time() - start_time
    print(f"\n🎉 Done in {elapsed/60:.1f} min")
    print(f"   ✅ Updated in Supabase : {counters['ok']}")
    print(f"   ❌ Failed (scrape/write): {counters['fail']}")
    print(f"   ⏭  No URL (skipped)   : {counters['skip']}")


if __name__ == "__main__":
    main()
