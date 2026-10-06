#!/usr/bin/env python3
"""
Refresh reel view counts from Meta's official Instagram Graph API (Business Discovery).

No scraping and no Instagram logins: BuyHatke's own Business account looks up each
creator by handle and gets their recent reels with view_count, like_count,
comments_count and timestamp. Reels are matched to ours by the shortcode in each
permalink. Works for creators with a Business or Creator account; personal
accounts are reported and left untouched.

Writes go straight to Supabase and follow the view-count rule: a stored count is
only ever raised, never lowered or blanked. Publish dates are only filled if empty.

Env (e.g. ~/.daily_sync.env on the VM):
    META_GRAPH_TOKEN           system-user token (instagram_basic, instagram_manage_insights,
                               pages_read_engagement, pages_show_list, business_management)
    META_IG_USER_ID            BuyHatke's instagram_business_account id
    SUPABASE_SERVICE_ROLE_KEY  for reading reels and writing counts
    META_GRAPH_VERSION         optional, default v23.0

Usage:
    python3 scripts/graph_refresh_views.py --creator adrika.speaks   # dry-run one creator
    python3 scripts/graph_refresh_views.py                           # dry-run: reels from last 30 days
    python3 scripts/graph_refresh_views.py --days 60 --apply         # write
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xzutldcwrlrfkzkqtjyn.supabase.co")
GRAPH = f"https://graph.facebook.com/{os.environ.get('META_GRAPH_VERSION', 'v23.0')}"
MEDIA_FIELDS = "permalink,media_product_type,view_count,like_count,comments_count,timestamp"
# Meta meters call time/CPU too; asking for less per post fits more calls in the hourly limit.
LIGHT_MEDIA_FIELDS = "permalink,view_count"
HANDLE_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
PERMALINK_RE = re.compile(r"instagram\.com/(?:[^/]+/)?(?:reels?|p|tv)/([A-Za-z0-9_-]+)")
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
# Graph API error codes that mean "stop for now" rather than "skip this creator".
RATE_LIMIT_CODES = {4, 17, 32, 613, 80002}


def posted_at(shortcode: str) -> datetime | None:
    """Upload time encoded in a shortcode (media ids are time-ordered)."""
    try:
        n = 0
        for c in shortcode[:11]:
            n = n * 64 + ALPHABET.index(c)
        return datetime.fromtimestamp(((n >> 23) + 1314220021721) / 1000, tz=timezone.utc)
    except (ValueError, TypeError):
        return None


def supabase_headers() -> dict:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def load_target_reels(days: int, creator: str | None, skip_dead: bool = False) -> dict[str, dict[str, dict]]:
    """{handle_lower: {shortcode: row}} for reels posted in the window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    params = {"select": "id,shortcode,ownerusername,videoplaycount,takenat"}
    if skip_dead:
        # Reels already marked unavailable; creators left with none are skipped entirely.
        params["or"] = "(refresh_failed.is.null,refresh_failed.eq.false)"
    if creator:
        params["ownerusername"] = f"ilike.{creator}"
    rows, start = [], 0
    while True:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/reels", params=params,
                         headers={**supabase_headers(), "Range": f"{start}-{start + 999}"}, timeout=30)
        r.raise_for_status()
        page = r.json()
        rows += page
        if len(page) < 1000:
            break
        start += 1000

    by_creator: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in rows:
        sc, handle = row.get("shortcode"), (row.get("ownerusername") or "").strip()
        when = posted_at(sc or "")
        if not sc or not when or (not creator and when < cutoff):
            continue
        by_creator[handle.lower() if HANDLE_RE.match(handle) else "__no_handle__:" + handle][sc] = row
    return by_creator


class GraphError(Exception):
    def __init__(self, err: dict):
        self.code = err.get("code")
        self.message = err.get("message", "")
        super().__init__(f"({self.code}) {self.message}")


# Highest % of Meta's hourly allowance used, from the last response's usage headers.
LAST_USAGE = 0


def note_usage(response: requests.Response) -> None:
    """Record app / business-use-case usage (% of the hourly limit) from response headers."""
    global LAST_USAGE
    peak = 0
    for name in ("x-app-usage", "x-business-use-case-usage"):
        raw = response.headers.get(name)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        entries = [data] if name == "x-app-usage" else [e for v in data.values() for e in v]
        for e in entries:
            peak = max(peak, *(int(e.get(k, 0) or 0) for k in ("call_count", "total_time", "total_cputime")))
    LAST_USAGE = peak


def pace(base: float) -> None:
    """Go fast while usage is low; slow down well before Meta's limit."""
    if LAST_USAGE >= 95:
        delay = 600
    elif LAST_USAGE >= 85:
        delay = 120
    elif LAST_USAGE >= 70:
        delay = 30
    else:
        delay = base
    if delay > base:
        print(f"   usage {LAST_USAGE}% of Meta's hourly limit → waiting {delay}s", flush=True)
    time.sleep(delay)


def fetch_creator_media(handle: str, wanted: set[str], oldest: datetime, max_pages: int = 4,
                        fields: str = MEDIA_FIELDS) -> dict[str, dict]:
    """Page through a creator's media until every wanted shortcode is found or we pass `oldest`."""
    token, ig_id = os.environ["META_GRAPH_TOKEN"], os.environ["META_IG_USER_ID"]
    found: dict[str, dict] = {}
    after = None
    for _ in range(max_pages):  # 50 posts per call
        media = f"media.limit(50){'.after(' + after + ')' if after else ''}{{{fields}}}"
        r = requests.get(f"{GRAPH}/{ig_id}", timeout=60, params={
            "fields": f"business_discovery.username({handle}){{{media}}}",
            "access_token": token,
        })
        note_usage(r)
        body = r.json()
        if "error" in body:
            raise GraphError(body["error"])
        page = (body.get("business_discovery") or {}).get("media") or {}
        for m in page.get("data", []):
            match = PERMALINK_RE.search(m.get("permalink", ""))
            if match and match.group(1) in wanted:
                found[match.group(1)] = m
        items = page.get("data") or []
        last_ts = items[-1].get("timestamp") if items else None
        after = (page.get("paging") or {}).get("cursors", {}).get("after")
        if len(found) == len(wanted) or not after or not items:
            break
        if last_ts and datetime.fromisoformat(last_ts.replace("+0000", "+00:00")) < oldest:
            break
    return found


def apply_update(row: dict, m: dict) -> list[str]:
    """Write one reel. Returns a list of what changed (for the log)."""
    h = {**supabase_headers(), "Prefer": "return=minimal, count=exact"}
    url = f"{SUPABASE_URL}/rest/v1/reels"
    changed = []

    def patch(params: dict, body: dict) -> int:
        r = requests.patch(url, params={"id": f"eq.{row['id']}", **params}, headers=h, json=body, timeout=30)
        r.raise_for_status()
        return int((r.headers.get("content-range") or "*/0").split("/")[-1] or 0)

    views = m.get("view_count")
    if isinstance(views, int) and views > 1:
        # Raise only: the database may hold a higher count from an earlier source.
        if patch({"or": f"(videoplaycount.is.null,videoplaycount.lt.{views})"},
                 {"videoplaycount": views, "videoviewcount": views}):
            changed.append(f"views {row.get('videoplaycount')}→{views}")
    if m.get("timestamp") and patch({"takenat": "is.null"}, {"takenat": m["timestamp"]}):
        changed.append("date filled")
    rest = {"lastupdatedat": datetime.now(timezone.utc).isoformat(), "refresh_failed": False}
    if isinstance(m.get("like_count"), int):
        rest["likescount"] = m["like_count"]
    if isinstance(m.get("comments_count"), int):
        rest["commentscount"] = m["comments_count"]
    patch({}, rest)
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=30, help="Refresh reels posted in the last N days (default 30)")
    ap.add_argument("--creator", help="Only this handle (ignores --days)")
    ap.add_argument("--apply", action="store_true", help="Write to Supabase. Default: dry-run")
    ap.add_argument("--max-pages", type=int, default=4,
                    help="Calls per creator when paging back for older reels (50 posts each, default 4)")
    ap.add_argument("--start-at", type=int, default=1, help="Resume from this creator number (1-based)")
    ap.add_argument("--resume-from", help="Resume from this handle (creators run alphabetically)")
    ap.add_argument("--light", action="store_true", help="Fetch only permalink + view_count (cheaper calls)")
    ap.add_argument("--skip-dead", action="store_true", help="Skip reels already marked refresh_failed")
    ap.add_argument("--yield-to", metavar="SERVICE",
                    help="Pause while this systemd service is running (e.g. sheet-sync.service)")
    ap.add_argument("--wait-on-limit", action="store_true",
                    help="On Meta's rate limit, wait 15 min and resume instead of stopping (for long full runs)")
    # Base pause; pace() stretches it automatically as Meta's usage headers approach the limit.
    ap.add_argument("--pause", type=float, default=2.0, help="Base seconds between creators (default 2)")
    args = ap.parse_args()

    missing = [k for k in ("META_GRAPH_TOKEN", "META_IG_USER_ID", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(k)]
    if missing:
        print(f"❌ Missing env: {', '.join(missing)}")
        return 2

    targets = load_target_reels(args.days, args.creator, args.skip_dead)
    no_handle = {k: v for k, v in targets.items() if k.startswith("__no_handle__:")}
    creators = {k: v for k, v in targets.items() if k not in no_handle}
    total = sum(len(v) for v in creators.values())
    print(f"{'APPLY' if args.apply else 'DRY-RUN'}: {total} reels from {len(creators)} creators"
          f"{'' if args.creator else f' (posted in the last {args.days} days)'}")
    if no_handle:
        print(f"⏭  {len(no_handle)} creators skipped, stored without a real handle: "
              f"{[k.split(':', 1)[1] for k in no_handle][:10]}")

    stats = defaultdict(int)
    not_found: list[str] = []
    oldest = datetime.now(timezone.utc) - timedelta(days=args.days + 7)
    fields = LIGHT_MEDIA_FIELDS if args.light else MEDIA_FIELDS
    for i, (handle, reels) in enumerate(sorted(creators.items()), 1):
        if i < args.start_at or (args.resume_from and handle < args.resume_from.lower()):
            continue
        if args.yield_to:
            waited = False
            # A oneshot service reports "activating" (not "active") while it runs.
            while subprocess.run(["systemctl", "is-active", args.yield_to], capture_output=True,
                                 text=True).stdout.strip() in ("active", "activating"):
                if not waited:
                    print(f"⏸  {args.yield_to} is running; yielding Meta's allowance to it", flush=True)
                    waited = True
                time.sleep(60)
        if args.creator or args.days > 3650:
            # Old reels sit deep in a feed: page back far enough to reach them.
            oldest = min(posted_at(sc) for sc in reels) - timedelta(days=7)
        try:
            while True:
                try:
                    media = fetch_creator_media(handle, set(reels), oldest, args.max_pages, fields)
                    break
                except GraphError as e:
                    if e.code in RATE_LIMIT_CODES and args.wait_on_limit:
                        print(f"⏸  Rate limited at creator {i}/{len(creators)}; waiting 5 min", flush=True)
                        time.sleep(300)
                        continue
                    raise
        except GraphError as e:
            if e.code in RATE_LIMIT_CODES:
                print(f"🛑 Rate limited at creator {i}/{len(creators)}: {e}. Stopping; rerun later.")
                stats["rate_limited"] = 1
                break
            # Typically code 110 / "Invalid user id": personal account or wrong handle.
            not_found.append(f"{handle} ({e.code})")
            stats["creators_unavailable"] += 1
            pace(args.pause)
            continue
        stats["creators_ok"] += 1
        for sc, row in reels.items():
            m = media.get(sc)
            if not m:
                stats["reels_not_in_feed"] += 1
                continue
            stats["reels_matched"] += 1
            if not args.apply:
                print(f"  {handle:<24} {sc}  db={row.get('videoplaycount')}  graph={m.get('view_count')}"
                      f"  likes={m.get('like_count')}  posted={m.get('timestamp', '')[:10]}")
                continue
            changed = apply_update(row, m)
            if changed:
                stats["reels_changed"] += 1
                print(f"  {handle:<24} {sc}  {', '.join(changed)}")
        if i % 25 == 0:
            print(f"… creator {i}/{len(creators)}, usage {LAST_USAGE}%", flush=True)
        pace(args.pause)

    print("\nSummary:", dict(stats))
    if not_found:
        print(f"Unavailable (personal account or wrong handle), {len(not_found)}: {not_found[:25]}")
    return 1 if stats.get("rate_limited") else 0


if __name__ == "__main__":
    sys.exit(main())
