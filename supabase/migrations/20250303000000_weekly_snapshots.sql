-- Weekly snapshots for "this week vs last week" summary
-- Save once per week to compare: current totals vs previous week totals
CREATE TABLE IF NOT EXISTS public.weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  total_views bigint NOT NULL DEFAULT 0,
  total_reels int NOT NULL DEFAULT 0,
  total_likes bigint NOT NULL DEFAULT 0,
  total_comments bigint NOT NULL DEFAULT 0,
  total_payout numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_week_start ON public.weekly_snapshots(week_start_date DESC);

COMMENT ON TABLE public.weekly_snapshots IS 'Weekly snapshots of team totals for week-over-week comparison';

ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weekly snapshots" ON public.weekly_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert weekly snapshots" ON public.weekly_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update weekly snapshots" ON public.weekly_snapshots FOR UPDATE USING (true);
