#!/usr/bin/env python3
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
COOKIES = [
    'cookies_bhdemo2025.txt',
    'cookies_hatke_automation.txt',
    'cookies_goodmorningcuties.txt',
    'cookies_insta_automation.txt',
]

with open('/tmp/july_scs.json') as f:
    july_scs = set(json.load(f))

# Get all July reels from DB
all_reels, from_ = [], 0
while True:
    r = sb.table('reels').select('id,shortcode,permalink,url,videoplaycount,takenat').range(from_, from_+999).execute()
    all_reels.extend(r.data or [])
    if len(r.data or []) < 1000: break
    from_ += 1000

july_reels = [x for x in all_reels if x.get('shortcode') in july_scs]
print(f'July reels to scrape: {len(july_reels)}')

updates = []
ok = fail = 0
for i, reel in enumerate(july_reels):
    sc = reel['shortcode']
    url = reel.get('permalink') or reel.get('url') or f'https://www.instagram.com/reel/{sc}/'
    cf = COOKIES[i % len(COOKIES)]
    acct = cf.replace('cookies_', '').replace('.txt', '')
    result = fetch_engagement(url, cf, acct)
    if result:
        eng = result.get('engagement', {}); play = eng.get('play_count') or 0
        ts = result.get('timestamp')
        upd = {
            'shortcode': sc,
            'videoplaycount': play,
            'likescount': eng.get('like_count') or 0,
            'commentscount': eng.get('comment_count') or 0,
        }
        if ts and not reel.get('takenat'):
            upd['takenat'] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        updates.append(upd); ok += 1
        print(f'OK {sc}: {play}')
    else:
        fail += 1
        print(f'FAIL {sc}')

    if len(updates) >= 20:
        res = requests.post(f'{RENDER}/api/bulk-update-views', json={'updates': updates}, timeout=40)
        print(f'Written: {res.json()}')
        updates = []
    time.sleep(2)

if updates:
    res = requests.post(f'{RENDER}/api/bulk-update-views', json={'updates': updates}, timeout=40)
    print(f'Final: {res.json()}')

print(f'DONE: ok={ok} fail={fail}')
