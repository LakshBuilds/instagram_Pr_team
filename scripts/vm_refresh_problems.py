#!/usr/bin/env python3
"""
Targeted refresh for problem reels:
  - 0 views OR null views
  - missing publish date (takenat)
  - is_archived = true
  - refresh_failed = true

Reads /tmp/problem_reels.json (pre-built), scrapes via instagrapi,
writes back via Render /api/bulk-update-views.

If reel comes back successfully → clears is_archived + refresh_failed flags.
If reel is truly dead (404) → marks is_archived=true, refresh_failed=true.
"""
import os, sys, time, json, threading
from datetime import datetime, timezone
from queue import Queue, Empty

sys.path.insert(0, '/home/ubuntu/instagram_view_counter_api')

import requests
from supabase import create_client

SUPABASE_URL = "https://xzutldcwrlrfkzkqtjyn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk"
RENDER_API   = "https://instagram-pr-api.onrender.com"
COOKIE_FILES = [
    "/home/ubuntu/instagram_view_counter_api/cookies_bhdemo2025.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_hatke_automation.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_goodmorningcuties.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_insta_automation.txt",
]
CONCURRENCY  = 6
WRITE_BATCH  = 50

_cookie_lock = threading.Lock()
_cookie_idx  = [0]

def next_cookie():
    with _cookie_lock:
        f = COOKIE_FILES[_cookie_idx[0] % len(COOKIE_FILES)]
        _cookie_idx[0] += 1
    return f

def get_url(reel):
    for f in ("permalink", "url", "inputurl"):
        v = (reel.get(f) or "").strip()
        if v: return v
    sc = reel.get("shortcode")
    return f"https://www.instagram.com/reel/{sc}/" if sc else None

def scrape_one(reel_url):
    """Returns (play, likes, comments, timestamp, is_dead)"""
    from scraper_instagrapi import fetch_engagement
    cookie_file = next_cookie()
    account = os.path.basename(cookie_file).replace("cookies_","").replace(".txt","")
    try:
        result = fetch_engagement(reel_url, cookie_file, account)
        if not result:
            return None, None, None, None, False
        eng       = result.get("engagement") or {}
        play      = eng.get("play_count") or eng.get("view_count") or eng.get("views")
        likes     = eng.get("like_count")
        comments  = eng.get("comment_count")
        timestamp = result.get("timestamp")
        return (
            int(play)      if play      is not None else None,
            int(likes)     if likes     is not None else None,
            int(comments)  if comments  is not None else None,
            int(timestamp) if timestamp is not None else None,
            False,
        )
    except Exception as e:
        err = str(e).lower()
        is_dead = "not found" in err or "unavailable" in err or "media" in err
        return None, None, None, None, is_dead

def flush_to_render(batch):
    if not batch: return 0, 0
    try:
        r = requests.post(f"{RENDER_API}/api/bulk-update-views",
                          json={"updates": batch}, timeout=30)
        if r.ok:
            d = r.json()
            return d.get("applied", 0), d.get("errors", 0)
        return 0, len(batch)
    except Exception as e:
        print(f"  flush err: {e}")
        return 0, len(batch)

def reader_worker(task_q, pending_q, counters, lock):
    while True:
        try: reel = task_q.get_nowait()
        except Empty: break

        reel_url = get_url(reel)
        sc = reel.get("shortcode")
        if not reel_url or not sc:
            with lock: counters["skip"] += 1
            task_q.task_done(); continue

        play, likes, comments, timestamp, is_dead = scrape_one(reel_url)

        if is_dead:
            upd = {"shortcode": sc, "is_archived": True, "refresh_failed": True}
            pending_q.put(upd)
            with lock: counters["dead"] += 1
            task_q.task_done(); continue

        if play is None and timestamp is None:
            with lock: counters["empty"] += 1
            task_q.task_done(); continue

        old_play = reel.get("videoplaycount") or 0
        new_play = max(int(play), int(old_play)) if play is not None else None

        upd = {
            "shortcode": sc,
            "refresh_failed": False,
            "is_archived": False,
        }
        if new_play  is not None: upd["videoplaycount"] = new_play
        if likes     is not None: upd["likescount"]     = likes
        if comments  is not None: upd["commentscount"]  = comments

        if timestamp and not reel.get("takenat"):
            dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            upd["takenat"] = dt.isoformat()
            with lock: counters["dates_filled"] += 1

        pending_q.put(upd)
        with lock: counters["fetched"] += 1
        task_q.task_done()

def writer_worker(pending_q, done_event, counters, lock):
    buf = []
    while not done_event.is_set() or not pending_q.empty():
        try:
            item = pending_q.get(timeout=3)
            buf.append(item)
            if len(buf) >= WRITE_BATCH:
                a, e = flush_to_render(buf)
                with lock: counters["ok"] += a; counters["wfail"] += e
                buf = []
        except Empty:
            if buf:
                a, e = flush_to_render(buf)
                with lock: counters["ok"] += a; counters["wfail"] += e
                buf = []
    if buf:
        a, e = flush_to_render(buf)
        with lock: counters["ok"] += a; counters["wfail"] += e

def main():
    with open("/tmp/problem_reels.json") as f:
        reels = json.load(f)

    total = len(reels)
    print(f"🎯 {total} problem reels to retry")
    print(f"   (0 views / null views / missing date / archived / refresh_failed)\n")

    task_q, pending_q = Queue(), Queue()
    for r in reels: task_q.put(r)

    counters = {
        "ok": 0, "fetched": 0, "dead": 0, "empty": 0,
        "skip": 0, "wfail": 0, "dates_filled": 0
    }
    lock = threading.Lock()
    done_event = threading.Event()
    start = time.time()

    wt = threading.Thread(target=writer_worker,
                          args=(pending_q, done_event, counters, lock), daemon=True)
    wt.start()

    readers = []
    for _ in range(min(CONCURRENCY, total)):
        t = threading.Thread(target=reader_worker,
                             args=(task_q, pending_q, counters, lock), daemon=True)
        t.start(); readers.append(t)

    print(f"🚀 {len(readers)} workers running...\n")
    while any(t.is_alive() for t in readers):
        time.sleep(20)
        with lock:
            done  = counters["fetched"] + counters["dead"] + counters["empty"] + counters["skip"]
            ok    = counters["ok"]
            dead  = counters["dead"]
            dates = counters["dates_filled"]
        elapsed = time.time() - start
        rate = done / elapsed * 60 if elapsed > 0 else 0
        eta  = (total - done) / (rate / 60) if rate > 0 else 0
        print(f"  {done}/{total}  ✅{ok} fixed  📅{dates} dates  💀{dead} dead  "
              f"{rate:.0f}/min  ETA {eta/60:.1f}min")

    for t in readers: t.join()
    done_event.set()
    wt.join()

    elapsed = time.time() - start
    with lock:
        print(f"\n🎉 Done in {elapsed/60:.1f} min")
        print(f"   ✅ Fixed (written)       : {counters['ok']}")
        print(f"   📅 Publish dates filled  : {counters['dates_filled']}")
        print(f"   💀 Confirmed dead        : {counters['dead']}")
        print(f"   ⚪ Empty/view-disabled   : {counters['empty']}")
        print(f"   ⏭  Skipped (no URL)     : {counters['skip']}")

if __name__ == "__main__":
    main()
