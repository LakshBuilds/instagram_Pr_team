#!/usr/bin/env python3
"""Scrape reels using ONLY hatke_automation with 5s delay between requests."""
import sys, json, requests, time
from datetime import datetime, timezone
sys.path.insert(0, '/home/ubuntu/instagram_view_counter_api')
from scraper_instagrapi import fetch_engagement
from supabase import create_client

sb = create_client(
    'https://xzutldcwrlrfkzkqtjyn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk'
)
RENDER = 'https://instagram-pr-api.onrender.com'
COOKIE = 'cookies_hatke_automation.txt'
ACCT   = 'hatke_automation'

with open('/tmp/july_42.json') as f:
    scs = json.load(f)

print(f'Scraping {len(scs)} reels using ONLY {ACCT} with 5s delay...')

# Get existing views
all_db, from_ = [], 0
while True:
    r = sb.table('reels').select('shortcode,videoplaycount,takenat').range(from_,from_+999).execute()
    all_db.extend(r.data or [])
    if len(r.data or []) < 1000: break
    from_ += 1000
db_map = {x['shortcode']: x for x in all_db if x.get('shortcode')}

updates = []
ok = fail = 0
for i, sc in enumerate(scs):
    url = f'https://www.instagram.com/reel/{sc}/'
    result = fetch_engagement(url, COOKIE, ACCT)
    if result:
        eng = result.get('engagement', {}); play = eng.get('play_count') or 0
        ts = result.get('timestamp')
        reel = db_map.get(sc, {})
        upd = {'shortcode': sc, 'videoplaycount': play,
               'likescount': eng.get('like_count') or 0,
               'commentscount': eng.get('comment_count') or 0}
        if ts and not reel.get('takenat'):
            upd['takenat'] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        updates.append(upd); ok += 1
        print(f'OK {i+1}/{len(scs)} {sc}: {play}')
    else:
        fail += 1
        print(f'FAIL {i+1}/{len(scs)} {sc}')

    if len(updates) >= 10:
        res = requests.post(f'{RENDER}/api/bulk-update-views', json={'updates': updates}, timeout=40)
        print(f'Written: {res.json()}'); updates = []
    time.sleep(5)

if updates:
    res = requests.post(f'{RENDER}/api/bulk-update-views', json={'updates': updates}, timeout=40)
    print(f'Final: {res.json()}')
print(f'DONE: ok={ok} fail={fail}')
