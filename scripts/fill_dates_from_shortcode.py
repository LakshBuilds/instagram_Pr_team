#!/usr/bin/env python3
"""
Fill missing publish dates (reels.takenat) from the reel's shortcode.

No Instagram traffic: a shortcode encodes the media id, and Instagram media ids are
time-ordered, so the upload time can be decoded directly. Checked against 3,460
reels that had a date: 95% match within a day (the rest are mostly scheduled posts).

Only fills reels whose takenat is empty; an existing date is never overwritten.

Env: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY), optional SUPABASE_URL.

Usage:
    python3 scripts/fill_dates_from_shortcode.py           # dry-run
    python3 scripts/fill_dates_from_shortcode.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xzutldcwrlrfkzkqtjyn.supabase.co")
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
INSTAGRAM_EPOCH_MS = 1314220021721  # media id = (ms since this) << 23 | shard/sequence


def posted_at(shortcode: str) -> datetime | None:
    """Upload time encoded in a shortcode, or None if it isn't a valid one."""
    if not shortcode or len(shortcode) < 11 or any(c not in ALPHABET for c in shortcode[:11]):
        return None
    n = 0
    for c in shortcode[:11]:
        n = n * 64 + ALPHABET.index(c)
    when = datetime.fromtimestamp(((n >> 23) + INSTAGRAM_EPOCH_MS) / 1000, tz=timezone.utc)
    # Guard against garbage ids decoding to impossible dates.
    if not datetime(2016, 1, 1, tzinfo=timezone.utc) <= when <= datetime.now(timezone.utc):
        return None
    return when


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write to Supabase. Default: dry-run")
    args = ap.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    url = f"{SUPABASE_URL}/rest/v1/reels"

    rows, start = [], 0
    while True:
        r = requests.get(url, params={"select": "id,shortcode", "takenat": "is.null"}, timeout=30,
                         headers={**headers, "Range": f"{start}-{start + 999}"})
        r.raise_for_status()
        page = r.json()
        rows += page
        if len(page) < 1000:
            break
        start += 1000

    plan = [(row["id"], row["shortcode"], when) for row in rows if (when := posted_at(row.get("shortcode") or ""))]
    print(f"{'APPLY' if args.apply else 'DRY-RUN'}: {len(rows)} reels without a date, "
          f"{len(plan)} can be filled from their shortcode")
    for _, sc, when in plan[:5]:
        print(f"  {sc}  → {when:%Y-%m-%d %H:%M} UTC")
    if not args.apply:
        return 0

    filled = errors = 0
    for rid, sc, when in plan:
        # takenat=is.null in the filter: never overwrite a date set in the meantime.
        r = requests.patch(url, params={"id": f"eq.{rid}", "takenat": "is.null"}, timeout=30,
                           headers={**headers, "Prefer": "return=minimal"}, json={"takenat": when.isoformat()})
        if r.ok:
            filled += 1
        else:
            errors += 1
            print(f"  error {sc}: HTTP {r.status_code} {r.text[:120]}")
    print(f"filled {filled}, errors {errors}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
