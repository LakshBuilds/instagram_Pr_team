-- Add apify_api_key column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS apify_api_key text;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.apify_api_key IS 'User-specific Apify API key. If null, uses default key.';



