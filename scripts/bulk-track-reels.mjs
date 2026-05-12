#!/usr/bin/env node
/**
 * One-shot script: register every existing reel from Supabase with the
 * upstream scraper's daily trickle-refresh tracker.
 *
 * After running, all reels in the `reels` table will be refreshed once per
 * 24h automatically — view counts stay current on the dashboard even when
 * nobody opens the website.
 *
 * Run:    node scripts/bulk-track-reels.mjs
 * Env:    VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, INTERNAL_API_URL
 *
 * Idempotent — running multiple times is safe (upstream dedupes by shortcode).
 */
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'https://api.rareme.shop';
const BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(`📥 Fetching all reels from Supabase…`);
const allUrls = [];
let offset = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await supabase
    .from('reels')
    .select('url, permalink, shortcode')
    .range(offset, offset + PAGE - 1);
  if (error) {
    console.error('❌ Supabase fetch failed:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  for (const r of data) {
    const u = r.url || r.permalink
      || (r.shortcode ? `https://www.instagram.com/p/${r.shortcode}/` : null);
    if (u && u.includes('instagram.com')) allUrls.push(u);
  }
  if (data.length < PAGE) break;
  offset += PAGE;
}
console.log(`   Found ${allUrls.length} reel URLs`);
if (allUrls.length === 0) {
  console.log('Nothing to track. Done.');
  process.exit(0);
}

// Dedupe (Supabase may have multiple rows per shortcode)
const unique = [...new Set(allUrls)];
console.log(`   ${unique.length} unique after dedupe`);

console.log(`\n🌱 Posting to ${INTERNAL_API_URL}/track in batches of ${BATCH_SIZE}…`);
let added = 0;
let total = 0;
for (let i = 0; i < unique.length; i += BATCH_SIZE) {
  const batch = unique.slice(i, i + BATCH_SIZE);
  const qs = batch.map(u => `urls=${encodeURIComponent(u)}`).join('&');
  try {
    const res = await fetch(`${INTERNAL_API_URL}/track?${qs}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`   ⚠️  batch ${i / BATCH_SIZE + 1} HTTP ${res.status}`);
      continue;
    }
    added += body.added || 0;
    total = body.total_tracked || total;
    process.stdout.write(`   batch ${i / BATCH_SIZE + 1}/${Math.ceil(unique.length / BATCH_SIZE)}: +${body.added}, total tracked: ${total}\r`);
  } catch (e) {
    console.warn(`   ⚠️  batch ${i / BATCH_SIZE + 1} error: ${e.message}`);
  }
}
console.log(`\n\n✅ Done. Newly added: ${added}, total tracked upstream: ${total}.`);
console.log(`   Trickle will refresh each reel once every 24h, automatically.`);
console.log(`   Watch progress:  curl -sS ${INTERNAL_API_URL}/track | python3 -m json.tool | head`);
