#!/usr/bin/env python3
"""
Sync payment-tracking Google Sheet → Supabase via the Render API server.

Reads April, May, June worksheets, builds a list of reels + bonuses,
then POSTs them to:
  POST https://instagram-pr-api.onrender.com/api/import-reels  (upsert reels)
  POST https://instagram-pr-api.onrender.com/api/apply-bonuses (add bonus payout)

The server already has SUPABASE_SERVICE_ROLE_KEY, so RLS is bypassed there.

Usage:
    python3 scripts/sync_sheet_via_server.py           # dry-run
    python3 scripts/sync_sheet_via_server.py --apply   # write for real
    python3 scripts/sync_sheet_via_server.py --days 90 # wider window (default 90)
    python3 scripts/sync_sheet_via_server.py --sheet June  # single sheet only
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Optional

import gspread
import requests
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(HERE), ".env"))

SERVICE_ACCOUNT_JSON = os.environ.get(
    "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON",
    "/Users/buyhatke/Downloads/third-zephyr-483123-n7-f309dde8fb0a.json",
)
SHEET_URL = "https://docs.google.com/spreadsheets/d/1dbXp9qvp2ul1CJiwu7-CrmQ4PQ6oFzcgqqKNKoYMfZM/edit"
API_SERVER = "https://instagram-pr-api.onrender.com"
IMPORT_TOKEN = os.environ.get("IMPORT_REELS_TOKEN", "")  # optional auth header

# Normalize handler name variants → canonical email local-part
HANDLER_NORMALIZE = {
    "gurimar":    "gurnimar",
    "gurnimar":   "gurnimar",
    "gurnimarjit":"gurnimar",
    "muskan":     "muskan",
    "yash":       "yash",
    "yashmadaan": "yashmadaan",
    "rajoshree":  "rajoshree",
    "chirag":     "chirag",
    "mansoor":    "mansoor",
    "laksh":      "laksh",
    "eyaz":       "eyaz",
    "venkat":     "venkat",
    "samarth":    "samarth",
    "akshay":     "akshay",
}

def handler_to_email(handler: str) -> Optional[str]:
    if not handler:
        return None
    key = handler.strip().lower().replace(" ", "").replace(".", "")
    canon = HANDLER_NORMALIZE.get(key, key)
    if not canon.replace("_", "").isalnum():
        return None
    return f"{canon}@buyhatke.com"

SHORTCODE_RE = re.compile(
    r"instagram\.com/(?:[^/]+/)?(?:reels?|p)/([A-Za-z0-9_-]+)"
)

def parse_reel_url(raw: str):
    if not raw or "instagram.com" not in raw:
        return None, None
    m = SHORTCODE_RE.search(raw.strip())
    if not m:
        return None, None
    sc = m.group(1)
    return f"https://www.instagram.com/reel/{sc}/", sc

DAY_RE = re.compile(r"(\d{1,2})")
MONTH_NAMES = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4, "arpil": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

def parse_sheet_date(raw: str, fallback_month: int = None, default_year: int = None):
    if not raw:
        return None
    s = raw.strip().lower()
    day_m = DAY_RE.search(s)
    if not day_m:
        return None
    day = int(day_m.group(1))
    month = None
    for name, num in MONTH_NAMES.items():
        if name in s:
            month = num
            break
    if not month:
        month = fallback_month  # use sheet tab month as fallback
    if not month:
        return None
    year = default_year or datetime.utcnow().year
    try:
        return datetime(year, month, day)
    except ValueError:
        return None

def parse_amount(raw: str) -> int:
    if not raw:
        return 0
    digits = "".join(c for c in str(raw) if c.isdigit())
    return int(digits) if digits else 0

# Map sheet tab name → month number for date fallback
SHEET_MONTH = {
    "January": 1, "February": 2, "March": 3, "April": 4,
    "May": 5, "June": 6, "July": 7, "August": 8,
    "September": 9, "October": 10, "November": 11, "December": 12,
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="POST to server. Default: dry-run.")
    ap.add_argument("--days", type=int, default=90, help="Window of days back (default 90)")
    ap.add_argument("--sheet", type=str, default=None, help="Process only this sheet tab (e.g. June)")
    args = ap.parse_args()

    cutoff = datetime.utcnow() - timedelta(days=args.days)
    sheets_to_process = [args.sheet] if args.sheet else ["April", "May", "June", "july"]
    print(f"📅 Window: last {args.days} days (>= {cutoff.date()})")
    print(f"📋 Sheets: {sheets_to_process}\n")

    gc = gspread.service_account(filename=SERVICE_ACCOUNT_JSON)
    sh = gc.open_by_url(SHEET_URL)

    new_reels = []
    bonus_payments = []
    skipped = []

    for ws_name in sheets_to_process:
        try:
            ws = sh.worksheet(ws_name)
        except gspread.WorksheetNotFound:
            print(f"⚠️  Sheet '{ws_name}' not found — skipping")
            continue

        fallback_month = SHEET_MONTH.get(ws_name)
        rows = ws.get_all_values()
        print(f"  {ws_name}: {len(rows)-1} data rows")

        for i, r in enumerate(rows[1:], start=2):
            if not any(r):
                continue

            # Columns (0-indexed): A=0 username, E=4 payment, H=7 date,
            # J=9 confirmation, K=10 handler, L=11 poc, N=13 details, O=14 reel url
            username    = (r[0]  if len(r) > 0  else "").strip()
            payment     = parse_amount(r[4]  if len(r) > 4  else "")
            date_str    = (r[7]  if len(r) > 7  else "").strip()
            confirmed   = (r[9]  if len(r) > 9  else "").strip().lower()
            handler_raw = (r[10] if len(r) > 10 else "").strip()
            poc         = (r[11] if len(r) > 11 else "").strip()
            details     = (r[13] if len(r) > 13 else "").strip()
            reel_raw    = (r[14] if len(r) > 14 else "").strip()

            url, shortcode = parse_reel_url(reel_raw)
            email = handler_to_email(handler_raw)
            is_bonus = "bonus" in details.lower()

            # Only process rows where payment is confirmed
            if "done" not in confirmed:
                skipped.append((ws_name, i, f"Payment not confirmed ({confirmed!r})"))
                continue

            if not email:
                skipped.append((ws_name, i, f"Unknown handler {handler_raw!r}"))
                continue

            # Date filter
            dt = parse_sheet_date(date_str, fallback_month=fallback_month)
            if dt and dt < cutoff:
                skipped.append((ws_name, i, f"Too old ({dt.date()})"))
                continue

            if is_bonus:
                if not username:
                    skipped.append((ws_name, i, "Bonus row missing username"))
                    continue
                bonus_payments.append({
                    "ownerusername": username,
                    "amount": payment,
                    "shortcode": shortcode,
                })
            elif url:
                new_reels.append({
                    "url": url,
                    "shortcode": shortcode,
                    "ownerusername": username,
                    "payout": payment,
                    "created_by_email": email,
                    "created_by_name": handler_raw,
                    "locationname": poc or None,
                })
            else:
                skipped.append((ws_name, i, "No reel URL"))

    print(f"\n📝 Reels to upsert : {len(new_reels)}")
    print(f"💰 Bonus payments  : {len(bonus_payments)}")
    print(f"⏭  Skipped         : {len(skipped)}")

    if new_reels:
        print("\n--- sample reels (first 5) ---")
        for r in new_reels[:5]:
            print(f"  {r['shortcode']:14s}  @{r['ownerusername']:20s}  ₹{r['payout']:>5}  → {r['created_by_email']}")

    if bonus_payments:
        print("\n--- bonuses ---")
        for r in bonus_payments:
            print(f"  @{r['ownerusername']:20s}  +₹{r['amount']:>5}")

    if not args.apply:
        print("\n💡 Dry-run. Re-run with --apply to push to Supabase.")
        return

    # --- APPLY ---
    headers = {"Content-Type": "application/json"}
    if IMPORT_TOKEN:
        headers["X-Import-Token"] = IMPORT_TOKEN

    # Batch into chunks of 50 — Render free tier can be slow, keep batches small
    CHUNK = 50
    total_inserted = total_updated = total_errors = 0

    for start in range(0, len(new_reels), CHUNK):
        chunk = new_reels[start:start + CHUNK]
        print(f"\n⬆️  Sending reels {start+1}–{start+len(chunk)} of {len(new_reels)}...")
        resp = requests.post(
            f"{API_SERVER}/api/import-reels",
            json={"reels": chunk},
            headers=headers,
            timeout=120,
        )
        if not resp.ok:
            print(f"  ❌ HTTP {resp.status_code}: {resp.text[:300]}")
            total_errors += len(chunk)
            continue
        data = resp.json()
        ins = data.get("inserted", 0)
        upd = data.get("updated", 0)
        err = data.get("errors", 0)
        total_inserted += ins
        total_updated  += upd
        total_errors   += err
        print(f"  ✅ inserted={ins}, updated={upd}, errors={err}")
        if data.get("errorDetails"):
            for e in data["errorDetails"][:3]:
                print(f"     ⚠️  {e}")

    # Bonuses
    if bonus_payments:
        print(f"\n⬆️  Sending {len(bonus_payments)} bonus payments...")
        resp = requests.post(
            f"{API_SERVER}/api/apply-bonuses",
            json={"bonuses": bonus_payments},
            headers=headers,
            timeout=60,
        )
        if resp.ok:
            d = resp.json()
            print(f"  ✅ applied={d.get('applied')}, missing={d.get('missing')}, errors={d.get('errors')}")
        else:
            print(f"  ❌ HTTP {resp.status_code}: {resp.text[:200]}")

    print(f"\n🎉 Done! Total: inserted={total_inserted}, updated={total_updated}, errors={total_errors}")


if __name__ == "__main__":
    main()
