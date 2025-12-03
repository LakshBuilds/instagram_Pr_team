-- Add language field to reels table with default value
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'Hinglish';

-- Set all existing reels to Hinglish (in case there are any NULL values)
UPDATE public.reels 
SET language = 'Hinglish' 
WHERE language IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.reels.language IS 'Language of the reel content. Options: Hinglish, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi, Assamese, Maithili, Konkani, Sindhi, Kashmiri, Dogri, Manipuri (Meiteilon), All';

-- Create index for faster queries on language
CREATE INDEX IF NOT EXISTS idx_reels_language ON public.reels(language);

