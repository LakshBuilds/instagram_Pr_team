-- Add refresh_failed field to reels table to track failed refreshes
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS refresh_failed boolean DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.reels.refresh_failed IS 'Marks reels that failed during the last refresh attempt. Can be used to retry failed refreshes.';

-- Create index for faster queries on failed reels
CREATE INDEX IF NOT EXISTS idx_reels_refresh_failed ON public.reels(refresh_failed);









