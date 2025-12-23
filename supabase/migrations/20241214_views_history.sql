-- Views History Table for timestamp-based analytics
-- This stores snapshots of views at different timestamps

CREATE TABLE IF NOT EXISTS public.views_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id text NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
    shortcode text NOT NULL,
    ownerusername text,
    
    -- Engagement metrics at this timestamp
    videoplaycount bigint DEFAULT 0,
    videoviewcount bigint DEFAULT 0,
    likescount bigint DEFAULT 0,
    commentscount bigint DEFAULT 0,
    
    -- Timestamp when this snapshot was taken
    recorded_at timestamptz DEFAULT now() NOT NULL,
    
    -- Original posting date (for reference)
    takenat text,
    
    -- User who triggered this update
    updated_by_email text,
    
    created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_views_history_reel_id ON public.views_history(reel_id);
CREATE INDEX IF NOT EXISTS idx_views_history_recorded_at ON public.views_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_views_history_shortcode ON public.views_history(shortcode);
CREATE INDEX IF NOT EXISTS idx_views_history_ownerusername ON public.views_history(ownerusername);
CREATE INDEX IF NOT EXISTS idx_views_history_reel_recorded ON public.views_history(reel_id, recorded_at DESC);

-- Enable RLS on views_history
ALTER TABLE public.views_history ENABLE ROW LEVEL SECURITY;

-- RLS policy for views_history
CREATE POLICY "Users can view all views history" ON public.views_history
    FOR SELECT USING (true);

CREATE POLICY "Users can insert views history" ON public.views_history
    FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.views_history IS 'Stores historical snapshots of reel engagement metrics for timestamp-based analytics';
COMMENT ON COLUMN public.views_history.recorded_at IS 'When this snapshot was taken - used for timestamp-based analytics';
COMMENT ON COLUMN public.views_history.takenat IS 'Original posting date of the reel - for reference only';