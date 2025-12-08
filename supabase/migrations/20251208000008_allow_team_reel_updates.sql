-- Allow authenticated users to update any reel (team edits)
-- This fixes 400/403 errors when updating language/location/payout on shared reels.

DO $$
BEGIN
  -- Drop existing restrictive policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reels'
      AND policyname = 'Users can update own reels'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own reels" ON public.reels';
  END IF;

  -- Create permissive update policy for all authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reels'
      AND policyname = 'Users can update team reels'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update team reels"
             ON public.reels
             FOR UPDATE
             TO authenticated
             USING (true)
             WITH CHECK (true)';
  END IF;
END
$$;


