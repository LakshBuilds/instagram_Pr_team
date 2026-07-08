#!/bin/bash
# Wait for main refresh to finish, then retry failed reels
cd /home/ubuntu/instagram_view_counter_api
source venv/bin/activate
export IG_SCRAPER_PROXY=socks5h://127.0.0.1:40000

echo "[$(date)] Waiting for main refresh to complete..."
while pgrep -f vm_bulk_refresh_v2 > /dev/null; do
    sleep 30
done

echo "[$(date)] Main refresh done. Building retry list..."

python3 -u << 'PYEOF'
from supabase import create_client
import json
sb = create_client(
    'https://xzutldcwrlrfkzkqtjyn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk'
)
fields = 'id,shortcode,permalink,url,inputurl,videoplaycount,takenat,is_archived,refresh_failed'
PAGE, from_ = 1000, 0
seen = {}
while True:
    r1 = sb.table('reels').select(fields).eq('videoplaycount', 0).range(from_, from_+PAGE-1).execute()
    r2 = sb.table('reels').select(fields).is_('videoplaycount', 'null').range(from_, from_+PAGE-1).execute()
    r3 = sb.table('reels').select(fields).is_('takenat', 'null').range(from_, from_+PAGE-1).execute()
    for x in (r1.data or []) + (r2.data or []) + (r3.data or []):
        sc = x.get('shortcode') or x.get('id')
        if sc not in seen:
            seen[sc] = x
    if max(len(r1.data or []), len(r2.data or []), len(r3.data or [])) < PAGE:
        break
    from_ += PAGE
with open('/tmp/problem_reels.json', 'w') as f:
    json.dump(list(seen.values()), f)
print(f'Problem reels for retry: {len(seen)}')
PYEOF

echo "[$(date)] Starting retry..."
python3 -u /tmp/vm_refresh_problems.py
echo "[$(date)] All done."
