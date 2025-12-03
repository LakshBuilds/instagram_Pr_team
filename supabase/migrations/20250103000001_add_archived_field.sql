-- Add is_archived field to reels table
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.reels.is_archived IS 'Marks reels that are archived/restricted (e.g., restricted_page error from Apify). All counts are set to 0 for archived reels.';

-- Create index for faster queries on archived reels
CREATE INDEX IF NOT EXISTS idx_reels_is_archived ON public.reels(is_archived);



