# Link Tracker

A tool inside the PR Team dashboard for creating creator referral links on
`r.buyhatke.com` and reading back what the people who came through each link did.

Nav: **Link Tracker** · Route: `/link-tracker`

## Setup

### 1. Create the table

Run `supabase/migrations/create_creator_links_table.sql` against the Supabase project
(SQL editor, or the existing `run-migrations.mjs` pattern). It creates `creator_links`,
the registry of every creator link.

### 2. Add the API passkey to the server env

```
USERQUALITY_PASSKEY='<passkey from the UserQuality Postman collection>'
```

**The single quotes are required.** The passkey contains a `#`, and dotenv treats an
unquoted `#` as the start of a comment — the key silently truncates and every call
comes back `invalid auth!`.

Never commit the real value: this repo is public, and `.env` is gitignored for that
reason. Set it in the Render dashboard and in your local `.env` only.

This is read only by `server/index.js` and is never shipped to the browser. Set it in
the Render environment for the deployed server too.

### 3. Regenerate Supabase types (optional, tidies one workaround)

`creator_links` is not in `src/integrations/supabase/types.ts`, so `LinkTracker.tsx`
reaches it through an untyped client (`const db = supabase as unknown as SupabaseClient`)
— the same escape hatch already used for `language_locations`. Regenerating the types
lets that cast go away.

## What it shows

**Portfolio view** — total installs across all creator links, split by Android / iOS /
Extension, retention, installs by platform, top creators by installs, installs over time
stacked by platform, and a sortable table with per-platform columns.

**Creator view** — installs, uninstalls, retention, peak monthly users, total actions;
an installs-by-day chart for the last 60 days (the spike shows which day a post landed);
monthly engagement; and a feature breakdown. Filterable by platform.

## The two endpoints, and why both are called

`server/index.js` exposes `GET /api/link-tracker/stats/:code`, which calls **both**
BuyHatke endpoints in parallel:

| | `userQuality` (monthly) | `userQualityDayWise` |
|---|---|---|
| Install data | **extension only — wrong** | extension + Android + iOS |
| Speed | ~45–55s | ~10s, but 504s on very large codes |
| Used for | engagement, long history | **all install numbers**, day chart |

The monthly endpoint returns the `Uninstalled` bucket for the browser extension alone.
For code `POHFLIGHT` it reports **1 install**; the day-wise endpoint reports **9,856**
(8,994 Android, 861 iOS, 1 extension). Any creator driving app installs looks like
near-zero on the monthly endpoint.

So **installs always come from the day-wise endpoint**. If it fails for a creator, the UI
shows the monthly figure behind an amber "extension only — incomplete" warning rather
than passing it off as correct.

Worth raising with the backend team: the monthly endpoint's install data is broken.

## Counting rules

- **Installs, uninstalls and actions are additive** — those totals are exact.
- **Users are not.** `userCount` is distinct users *per feature per month*; the same
  person appears under several features, so summing inflates it. Every user figure in
  this tool is a **max** (the busiest single feature), i.e. a floor on real active users.
- The **current month is partial**, marked with `*` on the monthly chart.

## Performance

Upstream calls take 10–55s and 504 intermittently, so the server:

- caches each code for 6 hours in memory,
- retries each endpoint once,
- de-duplicates concurrent requests for the same code,
- serves stale data (flagged) when the upstream is unreachable.

The portfolio table loads with `?cached=1`, which never triggers an upstream call — so
opening the page can't fire a dozen slow requests at once. **Sync all** runs sequentially
and forces a refresh.

## Not included

There is no click data. BuyHatke logs every click — `getExtensionReferralCodes` returns a
`clickId` — but exposes no way to read those counts back. Getting click→install conversion
needs either a new internal endpoint aggregating that click table by code and day, or a
URL shortener placed in front of the links. The `creator_links.short_link` column is there
for the shortener route.
