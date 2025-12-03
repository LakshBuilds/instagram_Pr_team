-- Change created_by_user_id to store Clerk user IDs as text
ALTER TABLE public.reels
  DROP CONSTRAINT IF EXISTS reels_created_by_user_id_fkey;

ALTER TABLE public.reels
  ALTER COLUMN created_by_user_id TYPE text
  USING created_by_user_id::text;

COMMENT ON COLUMN public.reels.created_by_user_id IS 'Clerk user ID of the creator (e.g. user_xxx)';


ALTER TABLE public.reels
  DROP CONSTRAINT IF EXISTS reels_created_by_user_id_fkey;

ALTER TABLE public.reels
  ALTER COLUMN created_by_user_id TYPE text
  USING created_by_user_id::text;

COMMENT ON COLUMN public.reels.created_by_user_id IS 'Clerk user ID of the creator (e.g. user_xxx)';


