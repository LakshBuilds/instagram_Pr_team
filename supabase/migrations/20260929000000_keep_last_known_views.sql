-- Never lose a known view count.
--
-- Scrapes fail often (expired sessions, blocked accounts, Instagram hiding
-- counts), and several writers turned a failure into a bad value: scripts that
-- read the embed page saved a placeholder of 1, the dashboard's refresh fell
-- back to 0, and repair scripts only look for null/0, so a placeholder 1 was
-- never retried. On 2026-09-29, 1,717 reels showed exactly 1 view.
--
-- Rule, enforced for every writer (browser, Render server, scripts):
--   * An update keeps the stored count unless the new value is a real, higher
--     number. Null, 0, 1 and any lower value leave the old count in place.
--   * An insert treats 1 as "unknown" and stores null, so repair tools see it.
--
-- To lower a count on purpose (e.g. correcting a bad value), in the same
-- transaction:  set local app.allow_views_decrease = 'on';

create or replace function public.keep_last_known_views()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.videoplaycount is not null and new.videoplaycount <= 1 then
      new.videoplaycount := null;
    end if;
    if new.videoviewcount is not null and new.videoviewcount <= 1 then
      new.videoviewcount := null;
    end if;
    return new;
  end if;

  if coalesce(current_setting('app.allow_views_decrease', true), '') = 'on' then
    return new;
  end if;

  if old.videoplaycount is not null
     and (new.videoplaycount is null or new.videoplaycount <= 1
          or new.videoplaycount < old.videoplaycount) then
    new.videoplaycount := old.videoplaycount;
  end if;

  if old.videoviewcount is not null
     and (new.videoviewcount is null or new.videoviewcount <= 1
          or new.videoviewcount < old.videoviewcount) then
    new.videoviewcount := old.videoviewcount;
  end if;

  return new;
end;
$$;

drop trigger if exists reels_keep_last_known_views on public.reels;
create trigger reels_keep_last_known_views
  before insert or update of videoplaycount, videoviewcount on public.reels
  for each row execute function public.keep_last_known_views();
