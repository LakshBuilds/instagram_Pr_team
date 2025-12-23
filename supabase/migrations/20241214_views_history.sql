-- Views History Table for timestamp-based analytics
-- This stores snapshots of views at different timestamps

CREATE TABLE IF NOT EXISTS public.views_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id text NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
    shortcode text NOT NULL,
    ownerusername text,
    
    -- Engagement metrics at this timestamp
    videoplaycount integer DEFAULT 0,
    videoviewcount integer DEFAULT 0,
    likescount integer DEFAULT 0,
    commentscount integer DEFAULT 0,
    
    -- Timestamp when this snapshot was taken
    recorded_at timestamptz DEFAULT now() NOT NULL,
    
    -- Original posting date (for reference)
    takenat timestamptz,
    
    -- User who triggered this update
    updated_by_email text,
    
    -- Indexes for fast queries
    created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_views_history_reel_id ON public.views_history(reel_id);
CREATE INDEX IF NOT EXISTS idx_views_history_recorded_at ON public.views_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_views_history_shortcode ON public.views_history(shortcode);
CREATE INDEX IF NOT EXISTS idx_views_history_ownerusername ON public.views_history(ownerusername);

-- Composite index for date range queries
CREATE INDEX IF NOT EXISTS idx_views_history_reel_recorded ON public.views_history(reel_id, recorded_at DESC);

-- Add decay_priority column to reels table for smart refresh
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS decay_priority integer DEFAULT 100;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS last_refresh_at timestamptz;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS refresh_count integer DEFAULT 0;

-- Function to calculate decay priority based on age
-- Newer reels get higher priority (100), older reels get lower priority
CREATE OR REPLACE FUNCTION calculate_decay_priority(posting_date timestamptz)
RETURNS integer AS $$
DECLARE
    days_old integer;
    priority integer;
BEGIN
    days_old := EXTRACT(DAY FROM (now() - posting_date));
    
    -- Priority calculation:
    -- 0-7 days: 100 (highest priority - update every time)
    -- 8-14 days: 80 (high priority)
    -- 15-30 days: 60 (medium priority)
    -- 31-60 days: 40 (low priority)
    -- 61-90 days: 20 (very low priority)
    -- 90+ days: 10 (minimal priority - rarely update)
    
    IF days_old <= 7 THEN
        priority := 100;
    ELSIF days_old <= 14 THEN
        priority := 80;
    ELSIF days_old <= 30 THEN
        priority := 60;
    ELSIF days_old <= 60 THEN
        priority := 40;
    ELSIF days_old <= 90 THEN
        priority := 20;
    ELSE
        priority := 10;
    END IF;
    
    RETURN priority;
END;
$$ LANGUAGE plpgsql;

-- Function to get reels that need refresh based on decay priority
CREATE OR REPLACE FUNCTION get_reels_for_refresh(
    max_reels integer DEFAULT 50,
    user_email text DEFAULT NULL
)
RETURNS TABLE (
    reel_id text,
    shortcode text,
    ownerusername text,
    decay_priority integer,
    last_refresh_at timestamptz,
    days_since_refresh numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id as reel_id,
        r.shortcode,
        r.ownerusername,
        COALESCE(r.decay_priority, calculate_decay_priority(r.takenat::timestamptz)) as decay_priority,
        r.last_refresh_at,
        EXTRACT(EPOCH FROM (now() - COALESCE(r.last_refresh_at, r.created_at))) / 86400 as days_since_refresh
    FROM public.reels r
    WHERE 
        (user_email IS NULL OR r.created_by_email = user_email)
        AND r.shortcode IS NOT NULL
    ORDER BY 
        -- Prioritize by: decay_priority * days_since_refresh
        -- Higher priority reels that haven't been refreshed recently come first
        (COALESCE(r.decay_priority, calculate_decay_priority(r.takenat::timestamptz)) * 
         EXTRACT(EPOCH FROM (now() - COALESCE(r.last_refresh_at, r.created_at))) / 86400) DESC
    LIMIT max_reels;
END;
$$ LANGUAGE plpgsql;

-- Function to get views growth in a date range (based on recorded_at, not takenat)
CREATE OR REPLACE FUNCTION get_views_in_range(
    start_date timestamptz,
    end_date timestamptz,
    user_email text DEFAULT NULL
)
RETURNS TABLE (
    reel_id text,
    shortcode text,
    ownerusername text,
    views_at_start bigint,
    views_at_end bigint,
    views_growth bigint,
    likes_at_start bigint,
    likes_at_end bigint,
    likes_growth bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH start_views AS (
        SELECT DISTINCT ON (vh.reel_id)
            vh.reel_id,
            vh.videoplaycount,
            vh.likescount
        FROM public.views_history vh
        JOIN public.reels r ON r.id = vh.reel_id
        WHERE vh.recorded_at <= start_date
            AND (user_email IS NULL OR r.created_by_email = user_email)
        ORDER BY vh.reel_id, vh.recorded_at DESC
    ),
    end_views AS (
        SELECT DISTINCT ON (vh.reel_id)
            vh.reel_id,
            vh.videoplaycount,
            vh.likescount
        FROM public.views_history vh
        JOIN public.reels r ON r.id = vh.reel_id
        WHERE vh.recorded_at <= end_date
            AND (user_email IS NULL OR r.created_by_email = user_email)
        ORDER BY vh.reel_id, vh.recorded_at DESC
    )
    SELECT 
        COALESCE(sv.reel_id, ev.reel_id) as reel_id,
        r.shortcode,
        r.ownerusername,
        COALESCE(sv.videoplaycount, 0)::bigint as views_at_start,
        COALESCE(ev.videoplaycount, 0)::bigint as views_at_end,
        (COALESCE(ev.videoplaycount, 0) - COALESCE(sv.videoplaycount, 0))::bigint as views_growth,
        COALESCE(sv.likescount, 0)::bigint as likes_at_start,
        COALESCE(ev.likescount, 0)::bigint as likes_at_end,
        (COALESCE(ev.likescount, 0) - COALESCE(sv.likescount, 0))::bigint as likes_growth
    FROM end_views ev
    FULL OUTER JOIN start_views sv ON sv.reel_id = ev.reel_id
    JOIN public.reels r ON r.id = COALESCE(sv.reel_id, ev.reel_id);
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on views_history
ALTER TABLE public.views_history ENABLE ROW LEVEL SECURITY;

-- RLS policy for views_history (users can see all views history for now)
CREATE POLICY "Users can view all views history" ON public.views_history
    FOR SELECT USING (true);

CREATE POLICY "Users can insert views history" ON public.views_history
    FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.views_history IS 'Stores historical snapshots of reel engagement metrics for timestamp-based analytics';
COMMENT ON COLUMN public.views_history.recorded_at IS 'When this snapshot was taken - used for timestamp-based analytics';
COMMENT ON COLUMN public.views_history.takenat IS 'Original posting date of the reel - for reference only';
COMMENT ON COLUMN public.reels.decay_priority IS 'Priority for refresh: 100=highest (new reels), 10=lowest (old reels)';
COMMENT ON COLUMN public.reels.last_refresh_at IS 'When this reel was last refreshed/updated';