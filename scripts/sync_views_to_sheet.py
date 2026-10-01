#!/usr/bin/env python3
"""
Copy view counts from Supabase into column Q ("Views (Play Count)") of the
payment sheet's month tabs.

No Instagram traffic: it only copies counts the phone counter already collected.
It writes column Q and nothing else, matching rows by the reel link in column O.

Safety rules:
  - only real counts (> 1) are written; a row with no known count is left alone
  - a cell that already holds a higher number is never lowered
  - a cell with text (not a number) is never overwritten, only reported

Usage:
    python3 scripts/sync_views_to_sheet.py              # dry-run: previous + current month tabs
    python3 scripts/sync_views_to_sheet.py --apply
    python3 scripts/sync_views_to_sheet.py --sheet August --apply
    python3 scripts/sync_views_to_sheet.py --all-tabs --apply   # every month tab
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

import gspread
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_sheet_via_server import SERVICE_ACCOUNT_JSON, SHEET_URL, parse_reel_url  # noqa: E402

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xzutldcwrlrfkzkqtjyn.supabase.co")
VIEWS_COL = 17  # Q
VIEWS_HEADER = "Views (Play Count)"
URL_COL = 15    # O: "Instagram Reel Link"


def supabase_views(shortcodes: set[str]) -> dict[str, int]:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    codes, views = sorted(shortcodes), {}
    for i in range(0, len(codes), 80):
        quoted = ",".join(f'"{c}"' for c in codes[i:i + 80])
        r = requests.get(f"{SUPABASE_URL}/rest/v1/reels", headers=headers, timeout=30,
                         params={"select": "shortcode,videoplaycount", "shortcode": f"in.({quoted})"})
        r.raise_for_status()
        for row in r.json():
            v = row.get("videoplaycount")
            if isinstance(v, (int, float)) and v > 1:
                views[row["shortcode"]] = max(int(v), views.get(row["shortcode"], 0))
    return views


def as_number(cell: str) -> int | None:
    try:
        return int(float(cell.replace(",", "").strip()))
    except ValueError:
        return None


MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]


def month_tabs(sh) -> list[str]:
    """Every tab named after a month, in sheet order."""
    return [ws.title for ws in sh.worksheets() if ws.title.strip().lower() in MONTHS]


def default_tabs(sh) -> list[str]:
    by_lower = {ws.title.strip().lower(): ws.title for ws in sh.worksheets()}
    today = datetime.utcnow()
    prev = today.replace(day=1) - timedelta(days=1)
    wanted = [datetime(prev.year, prev.month, 1).strftime("%B"), today.strftime("%B")]
    return [by_lower[m.lower()] for m in wanted if m.lower() in by_lower]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write to the sheet. Default: dry-run")
    ap.add_argument("--sheet", help="Only this tab (e.g. August)")
    ap.add_argument("--all-tabs", action="store_true", help="Every month tab, not just previous + current")
    args = ap.parse_args()

    sh = gspread.service_account(filename=SERVICE_ACCOUNT_JSON).open_by_url(SHEET_URL)
    tabs = [args.sheet] if args.sheet else month_tabs(sh) if args.all_tabs else default_tabs(sh)
    print(f"{'APPLY' if args.apply else 'DRY-RUN'}: tabs {tabs}")

    for tab in tabs:
        ws = sh.worksheet(tab)
        rows = ws.get_all_values()
        row_codes = {}
        for i, r in enumerate(rows[1:], start=2):
            sc = parse_reel_url(r[URL_COL - 1] if len(r) >= URL_COL else "")[1]
            if sc:
                row_codes[i] = sc
        views = supabase_views(set(row_codes.values()))

        updates, kept_higher, text_cells, no_count = [], 0, [], 0
        header = rows[0][VIEWS_COL - 1] if rows and len(rows[0]) >= VIEWS_COL else ""
        if header.strip() != VIEWS_HEADER:
            if header.strip():
                print(f"  ⚠️  {tab}!Q1 holds {header!r}; not a views column, skipping tab")
                continue
            updates.append({"range": "Q1", "values": [[VIEWS_HEADER]]})
        for i, sc in row_codes.items():
            v = views.get(sc)
            if v is None:
                no_count += 1
                continue
            r = rows[i - 1]
            current = r[VIEWS_COL - 1].strip() if len(r) >= VIEWS_COL else ""
            if current:
                n = as_number(current)
                if n is None:
                    text_cells.append(f"Q{i}={current!r}")
                    continue
                if n >= v:
                    kept_higher += n > v
                    continue
            updates.append({"range": f"Q{i}", "values": [[v]]})

        cells = [u for u in updates if u["range"] != "Q1"]
        print(f"  {tab}: {len(row_codes)} reel rows | {len(cells)} cells to write | "
              f"{no_count} without a known count | {kept_higher} already higher | {len(text_cells)} text cells left alone")
        for u in cells[:5]:
            print(f"    {u['range']} ← {u['values'][0][0]:,}")
        if text_cells:
            print(f"    text cells: {text_cells[:5]}")
        if args.apply and updates:
            ws.batch_update(updates, value_input_option="RAW")
            print(f"  ✅ wrote {len(cells)} cells to {tab}!Q")
    return 0


if __name__ == "__main__":
    sys.exit(main())
