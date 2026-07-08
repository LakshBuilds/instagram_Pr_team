#!/usr/bin/env python3
"""
Waits for vm_bulk_refresh_v2 to finish, then saves latest views to /tmp/views_for_sheet.json
Run on VM: python3 /tmp/wait_and_update_july.py
"""
import subprocess, time, sys, json
sys.path.insert(0, '/home/ubuntu/instagram_view_counter_api')

print('Waiting for bulk refresh to finish...')
while True:
    r = subprocess.run(['pgrep', '-f', 'vm_bulk_refresh_v2'], capture_output=True)
    if r.returncode != 0:
        print('Bulk refresh done! Fetching views...')
        break
    time.sleep(30)

from supabase import create_client
sb = create_client(
    'https://xzutldcwrlrfkzkqtjyn.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dXRsZGN3cmxyZmt6a3F0anluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg3MDUsImV4cCI6MjA3OTIwNDcwNX0.mRSVdOGhkqC-Gz1teYKWYDUDqjKZYca66rSkV-oW3fk'
)

all_db, from_ = [], 0
while True:
    r = sb.table('reels').select('shortcode,videoplaycount').range(from_, from_+999).execute()
    all_db.extend(r.data or [])
    if len(r.data or []) < 1000: break
    from_ += 1000

views_map = {x['shortcode']: int(x.get('videoplaycount') or 0) for x in all_db if x.get('shortcode')}
with open('/tmp/views_for_sheet.json', 'w') as f:
    json.dump(views_map, f)
print(f'Saved {len(views_map)} view counts to /tmp/views_for_sheet.json')
print('READY_TO_UPDATE')
