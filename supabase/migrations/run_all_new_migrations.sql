-- Combined migration file to add new features
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- Migration 1: Add Apify API Key to Profiles
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS apify_api_key text;

COMMENT ON COLUMN public.profiles.apify_api_key IS 'User-specific Apify API key. If null, uses default key.';

-- ============================================
-- Migration 2: Add Archived Field to Reels
-- ============================================
ALTER TABLE public.reels 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

COMMENT ON COLUMN public.reels.is_archived IS 'Marks reels that are archived/restricted (e.g., restricted_page error from Apify). All counts are set to 0 for archived reels.';

-- Create index for faster queries on archived reels
CREATE INDEX IF NOT EXISTS idx_reels_is_archived ON public.reels(is_archived);

-- ============================================
-- Migration Complete!
-- ============================================



