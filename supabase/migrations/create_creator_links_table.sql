-- Link Tracker: registry of creator referral links on r.buyhatke.com
--
-- One row per creator link. `code` is what gets sent to BuyHatke's userQuality
-- API; `slug` is the path on r.buyhatke.com. They are usually the same string in
-- different cases, but the tech team can attach a different code, so keep both.

create table if not exists public.creator_links (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  slug         text        not null unique,
  code         text        not null,
  handle       text        default '',
  channel      text        default '',
  campaign     text        default '',
  notes        text        default '',
  short_link   text,                    -- tracked shortener URL, if click tracking is on
  created_by   text,                    -- Clerk user email who added it
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists creator_links_code_idx     on public.creator_links (code);
create index if not exists creator_links_campaign_idx on public.creator_links (campaign);

-- Keep updated_at honest.
create or replace function public.touch_creator_links_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_links_touch_updated_at on public.creator_links;
create trigger creator_links_touch_updated_at
  before update on public.creator_links
  for each row execute function public.touch_creator_links_updated_at();

-- This dashboard authenticates with Clerk, not Supabase Auth, so RLS policies keyed
-- to auth.uid() would block every request. Matching the existing tables here, access
-- is left to the anon key.
alter table public.creator_links disable row level security;
