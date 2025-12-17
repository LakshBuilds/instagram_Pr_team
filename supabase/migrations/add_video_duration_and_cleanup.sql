-- ============================================
-- FULL SCRIPT: Clean data + add video_duration
-- ============================================

BEGIN;

-- 0) Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Assign UUID to any rows where id is NULL or empty
UPDATE reels 
SET id = gen_random_uuid()::text
WHERE (id IS NULL OR id = '');

-- 2) Try to fill missing shortcode from permalink / url / inputurl
UPDATE reels
SET shortcode = COALESCE(
  NULLIF(SUBSTRING(permalink FROM '/reel/([^/]+)'), ''),
  NULLIF(SUBSTRING(permalink FROM '/p/([^/]+)'), ''),
  NULLIF(SUBSTRING(url        FROM '/reel/([^/]+)'), ''),
  NULLIF(SUBSTRING(url        FROM '/p/([^/]+)'), ''),
  NULLIF(SUBSTRING(inputurl   FROM '/reel/([^/]+)'), ''),
  NULLIF(SUBSTRING(inputurl   FROM '/p/([^/]+)'), '')
)
WHERE (shortcode IS NULL OR shortcode = '')
  AND (permalink IS NOT NULL OR url IS NOT NULL OR inputurl IS NOT NULL);

-- 3) Remove duplicate shortcodes (keep exactly ONE row per shortcode)
DELETE FROM reels
WHERE ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY shortcode
        ORDER BY ctid
      ) AS rn
    FROM reels
    WHERE shortcode IS NOT NULL
      AND shortcode <> ''
  ) t
  WHERE t.rn > 1
);

-- 4) Ensure id has default UUID for all future inserts
ALTER TABLE reels
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 5) Make sure id is NOT NULL
ALTER TABLE reels
ALTER COLUMN id SET NOT NULL;

-- 6) Add UNIQUE constraint on shortcode
ALTER TABLE reels
DROP CONSTRAINT IF EXISTS reels_shortcode_unique;

ALTER TABLE reels
ADD CONSTRAINT reels_shortcode_unique UNIQUE (shortcode);

-- 7) Add video_duration column if it doesn't exist
ALTER TABLE reels 
ADD COLUMN IF NOT EXISTS video_duration INTEGER;

COMMENT ON COLUMN reels.video_duration IS 'Video duration in seconds';

COMMIT;

-- ============================================
-- VERIFY RESULTS
-- ============================================
SELECT 
  COUNT(*)                         AS total_reels,
  COUNT(id)                        AS with_id,
  COUNT(shortcode)                 AS with_shortcode,
  COUNT(DISTINCT shortcode)        AS unique_shortcodes,
  COUNT(video_duration)            AS with_duration,
  COUNT(*) - COUNT(DISTINCT shortcode) AS remaining_duplicates
FROM reels;






