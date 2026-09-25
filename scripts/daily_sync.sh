#!/bin/bash
# Daily job for the VM: import the payment sheet into Supabase, then fill in
# publish dates (takenat) for reels that don't have one yet, so they show up in
# the dashboard's monthly and date-range views.
#
# Runs from sheet-sync.service / sheet-sync.timer on the VM (03:00 UTC), which
# puts the scraper's venv on PATH and sets IG_SCRAPER_PROXY.
#
# Secrets come from ~/.daily_sync.env (override with DAILY_SYNC_ENV):
#   GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON=/home/ubuntu/google_service_account.json
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   IMPORT_REELS_TOKEN=...            # only if set on the Render server
#
# FILL_DATES_LIMIT caps reels scraped per run (default 150). The scraper shares
# Instagram accounts with the live API, so keep this modest.

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${DAILY_SYNC_ENV:-$HOME/.daily_sync.env}"

if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

# Date filling can run long; never let two runs overlap.
exec 9>/tmp/daily_sync.lock
if ! flock -n 9; then
  echo "[$(date -u +%FT%TZ)] previous run still in progress, skipping"
  exit 0
fi

cd "$REPO_DIR" || exit 1

echo "[$(date -u +%FT%TZ)] sheet sync: start"
python3 -u scripts/sync_sheet_via_server.py --apply
sync_status=$?
echo "[$(date -u +%FT%TZ)] sheet sync: exit $sync_status"

# Runs even if the sync failed: dates for already-imported reels still help.
echo "[$(date -u +%FT%TZ)] fill dates: start"
python3 -u scripts/vm_fill_dates.py --from-db --limit "${FILL_DATES_LIMIT:-150}"
fill_status=$?
echo "[$(date -u +%FT%TZ)] fill dates: exit $fill_status"

[ "$sync_status" -eq 0 ] && [ "$fill_status" -eq 0 ]
