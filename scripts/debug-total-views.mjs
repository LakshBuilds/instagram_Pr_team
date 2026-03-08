import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

function getReelViews(reel) {
  // Match app + SQL: only videoplaycount
  return Number(reel.videoplaycount) || 0;
}

async function fetchAllReels() {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  // First get count
  const { count, error: countError } = await supabase
    .from('reels')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error getting reels count:', countError);
    process.exit(1);
  }

  console.log('Total rows visible to this client:', count);

  while (from < count) {
    const to = Math.min(from + pageSize - 1, count - 1);
    const { data, error } = await supabase
      .from('reels')
      .select('*')
      .range(from, to);

    if (error) {
      console.error('Error fetching reels range', from, to, error);
      process.exit(1);
    }

    all = all.concat(data || []);
    from += pageSize;
  }

  return all;
}

async function main() {
  const reels = await fetchAllReels();

  const rawSumPlay = reels.reduce(
    (sum, r) => sum + (Number(r.videoplaycount) || 0),
    0
  );

  const bestByKey = new Map();
  for (const r of reels) {
    const key = r.shortcode || r.id;
    const existing = bestByKey.get(key);
    if (!existing || getReelViews(r) > getReelViews(existing)) {
      bestByKey.set(key, r);
    }
  }
  const uniqueReels = Array.from(bestByKey.values());

  console.log('Rows fetched:', reels.length);
  console.log('Unique reels by shortcode/id:', uniqueReels.length);
  console.log('SUM(videoplaycount) over visible rows           :', rawSumPlay);
  console.log('App-style totalViews (dedup, videoplaycount)    :', Array.from(bestByKey.values()).reduce(
    (sum, r) => sum + getReelViews(r),
    0
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

