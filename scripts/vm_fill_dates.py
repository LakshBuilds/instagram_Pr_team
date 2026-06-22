#!/usr/bin/env python3
"""
Fill missing takenat (publish date) for reels that have views but no date.
Reads /tmp/missing_dates.json, scrapes via instagrapi to get timestamp,
writes back via Render /api/bulk-update-views.

Uses slower rate (1 worker, 2s delay between requests) to avoid rate limiting
and maximise timestamp retrieval success.
"""
import os, sys, time, json, threading
from datetime import datetime, timezone
from queue import Queue, Empty

sys.path.insert(0, '/home/ubuntu/instagram_view_counter_api')
import requests

RENDER_API   = "https://instagram-pr-api.onrender.com"
COOKIE_FILES = [
    "/home/ubuntu/instagram_view_counter_api/cookies_bhdemo2025.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_hatke_automation.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_goodmorningcuties.txt",
    "/home/ubuntu/instagram_view_counter_api/cookies_insta_automation.txt",
]
WRITE_BATCH  = 5
DELAY_SEC    = 1.5   # slower = fewer rate-limit errors

_idx = [0]
def next_cookie():
    f = COOKIE_FILES[_idx[0] % len(COOKIE_FILES)]
    _idx[0] += 1
    return f

def get_url(reel):
    for f in ("permalink","url","inputurl"):
        v = (reel.get(f) or "").strip()
        if v: return v
    sc = reel.get("shortcode")
    return f"https://www.instagram.com/reel/{sc}/" if sc else None

def scrape_timestamp(reel_url):
    """Returns (timestamp, play_count) or (None, None)."""
    from scraper_instagrapi import fetch_engagement
    cf = next_cookie()
    acct = os.path.basename(cf).replace("cookies_","").replace(".txt","")
    try:
        result = fetch_engagement(reel_url, cf, acct)
        if not result: return None, None
        ts   = result.get("timestamp")
        eng  = result.get("engagement") or {}
        play = eng.get("play_count") or eng.get("view_count") or eng.get("views")
        return (int(ts) if ts else None, int(play) if play is not None else None)
    except Exception as e:
        return None, None

def flush(batch):
    if not batch: return 0, 0
    try:
        r = requests.post(f"{RENDER_API}/api/bulk-update-views",
                          json={"updates": batch}, timeout=30)
        if r.ok:
            d = r.json()
            return d.get("applied",0), d.get("errors",0)
        return 0, len(batch)
    except Exception as e:
        print(f"  flush err: {e}")
        return 0, len(batch)

def main():
    with open("/tmp/missing_dates.json") as f:
        reels = json.load(f)

    total = len(reels)
    print(f"📅 Filling publish dates for {total} reels\n")

    ok = err = filled = 0
    buf = []
    start = time.time()

    for i, reel in enumerate(reels):
        reel_url = get_url(reel)
        sc = reel.get("shortcode")
        if not reel_url or not sc:
            err += 1
            continue

        ts, play = scrape_timestamp(reel_url)

        if ts:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            upd = {"shortcode": sc, "takenat": dt}
            if play is not None:
                old = reel.get("videoplaycount") or 0
                upd["videoplaycount"] = max(int(play), int(old))
            # Flush immediately — don't batch, don't risk losing data
            a, e = flush([upd])
            ok += a
            if a: filled += 1
            else: err += 1
        else:
            err += 1

        elapsed = time.time()-start
        rate = (i+1)/elapsed*60 if elapsed>0 else 0
        eta  = (total-i-1)/(rate/60) if rate>0 else 0
        print(f"  {i+1}/{total}  📅{filled} written  ❌{err} failed  {rate:.0f}/min  ETA {eta/60:.1f}min")

        time.sleep(DELAY_SEC)

    elapsed = time.time()-start
    print(f"\n🎉 Done in {elapsed/60:.1f} min")
    print(f"   📅 Dates written : {filled}")
    print(f"   ❌ No timestamp  : {err}")

if __name__ == "__main__":
    main()
