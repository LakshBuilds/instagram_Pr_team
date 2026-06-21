// Express server for Apify API calls (server-side)
// This avoids CORS and bot detection issues

import dotenv from 'dotenv';
// Load .env file - dotenv will auto-detect .env in project root
dotenv.config();
console.log('🔍 INTERNAL_API_URL:', process.env.INTERNAL_API_URL || 'NOT SET');
import express from 'express';
import cors from 'cors';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fetchReelFromApify, fetchReelsFromApify } from './api/apify.js';

// Server-side Supabase client with service-role key (bypasses RLS — needed for the
// sheet-sync cron to insert reels attributed to handler emails like rajoshree@buyhatke.com).
// Falls back to anon key in dev; service-role is required in production.
const supabaseAdmin = (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VITE_SUPABASE_URL)
  ? createSupabaseClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
if (!supabaseAdmin) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set — /api/import-reels will be 503');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Handle CORS preflight requests
app.options('/api/apify/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle GET requests to API routes with helpful error
app.get('/api/apify/reel', (req, res) => {
  res.status(405).json({ 
    success: false, 
    error: 'Method not allowed. Use POST instead.',
    method: 'POST',
    endpoint: '/api/apify/reel',
    body: { url: 'string (required)', apiKey: 'string (optional)' }
  });
});

app.get('/api/apify/reels', (req, res) => {
  res.status(405).json({ 
    success: false, 
    error: 'Method not allowed. Use POST instead.',
    method: 'POST',
    endpoint: '/api/apify/reels',
    body: { urls: 'array (required)', apiKey: 'string (optional)' }
  });
});

// Apify API route - single reel
app.post('/api/apify/reel', async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    console.log('Fetching reel from Apify:', url);
    const items = await fetchReelFromApify(url, apiKey);
    
    res.json({ 
      success: true, 
      items 
    });
  } catch (error) {
    console.error('Error in /api/apify/reel:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Apify API route - bulk reels
app.post('/api/apify/reels', async (req, res) => {
  try {
    const { urls, apiKey } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'URLs array is required' 
      });
    }

    console.log('Fetching reels from Apify:', urls.length);
    const items = await fetchReelsFromApify(urls, apiKey);
    
    res.json({ 
      success: true, 
      items 
    });
  } catch (error) {
    console.error('Error in /api/apify/reels:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Internal API proxy - to avoid CORS issues
// REQUIRED: Set INTERNAL_API_URL in your .env file
const INTERNAL_API_URL = process.env.INTERNAL_API_URL;

if (!INTERNAL_API_URL) {
  console.error('❌ ERROR: INTERNAL_API_URL is required in .env file!');
  console.error('   Please add to .env: INTERNAL_API_URL=https://your-cloudflare-url.trycloudflare.com');
  process.exit(1);
}

console.log('✅ Internal API URL loaded from .env:', INTERNAL_API_URL);

// ============================================
// ASYNC JOB QUEUE FOR AVOIDING 30s TIMEOUT
// ============================================
const jobQueue = new Map(); // jobId -> { status, result, error, createdAt }

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Clean up old jobs (older than 10 minutes)
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [jobId, job] of jobQueue.entries()) {
    if (job.createdAt < tenMinutesAgo) {
      jobQueue.delete(jobId);
      console.log(`🧹 Cleaned up old job: ${jobId}`);
    }
  }
}, 60000); // Run every minute

// Submit async scrape job - returns immediately with job ID
app.post('/api/async/scrape', async (req, res) => {
  try {
    const url = req.query.url || req.body.url;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    const jobId = generateJobId();
    
    // Initialize job
    jobQueue.set(jobId, {
      status: 'pending',
      result: null,
      error: null,
      createdAt: Date.now(),
      url: url
    });

    console.log(`📋 Job ${jobId} created for URL: ${url}`);

    // Start processing in background (don't await)
    processJob(jobId, url);

    // Return immediately with job ID
    res.json({
      success: true,
      job_id: jobId,
      status: 'pending',
      message: 'Job submitted. Poll /api/async/status/:jobId for results.'
    });
  } catch (error) {
    console.error('Error creating async job:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Fire-and-forget: register this URL for the upstream's daily trickle refresh.
// Means: even when nobody opens the dashboard, view counts stay current.
async function trackUpstream(url) {
  try {
    await fetch(`${INTERNAL_API_URL}/track?urls=${encodeURIComponent(url)}`, {
      method: 'POST',
    });
  } catch {
    // ignore — tracking is best-effort, not on the critical path
  }
}

// Process job in background — submits to upstream's async endpoint (which has
// a global rate-limit gate to handle concurrent uploads safely) and polls
// for the result. Holds NO long HTTP connection on our side: each Node call
// is a fast submit/poll, so we can run many jobs in parallel cheaply.
async function processJob(jobId, url) {
  const job = jobQueue.get(jobId);
  if (!job) return;

  job.status = 'processing';
  console.log(`⚙️ Processing job ${jobId}...`);

  // Auto-register for the daily trickle refresh in parallel (best-effort)
  trackUpstream(url);

  const POLL_INTERVAL_MS = 3000;
  const MAX_POLL_ATTEMPTS = 120; // up to ~6 min for queue + scrape
  const SUBMIT_RETRY_BACKOFF_MS = 15000; // upstream may 503 if all accounts cooled

  let upstreamJobId = null;

  // Submit (with backoff on 503 "all accounts cooled down")
  for (let attempt = 1; attempt <= 3 && !upstreamJobId; attempt++) {
    try {
      const res = await fetch(
        `${INTERNAL_API_URL}/api/async/scrape?url=${encodeURIComponent(url)}`,
        { method: 'POST' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        const wait = (body?.detail?.retry_after_sec || 30) * 1000;
        console.log(`⏸️ Upstream throttled (503). Backing off ${wait/1000}s before retry ${attempt}`);
        job.status = 'queued_for_retry';
        await new Promise(r => setTimeout(r, Math.min(wait, SUBMIT_RETRY_BACKOFF_MS * attempt)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`Submit failed: HTTP ${res.status} - ${JSON.stringify(body)}`);
      }
      upstreamJobId = body.job_id;
      if (!upstreamJobId) throw new Error(`No job_id in submit response: ${JSON.stringify(body)}`);
    } catch (e) {
      console.error(`❌ Submit attempt ${attempt} for ${jobId} failed:`, e.message);
      if (attempt === 3) {
        job.status = 'failed';
        job.error = e.message;
        return;
      }
      await new Promise(r => setTimeout(r, SUBMIT_RETRY_BACKOFF_MS));
    }
  }

  // Poll upstream status until terminal
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`${INTERNAL_API_URL}/api/async/status/${upstreamJobId}`);
      if (!res.ok) {
        console.warn(`⚠️ Poll ${attempt} failed: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.status === 'completed' && data.result) {
        // `data.result` already matches the shape clients expect: {success, data, ...}
        job.status = 'completed';
        job.result = data.result;
        console.log(`✅ Job ${jobId} completed via upstream job ${upstreamJobId}`);
        return;
      }
      if (data.status === 'failed') {
        job.status = 'failed';
        job.error = data.error || 'Upstream job failed';
        console.error(`❌ Job ${jobId} failed: ${job.error}`);
        return;
      }
      // status is 'pending' or 'processing' — keep polling
    } catch (e) {
      console.warn(`⚠️ Poll attempt ${attempt} error: ${e.message}`);
    }
  }

  job.status = 'failed';
  job.error = `Timed out polling upstream after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`;
  console.error(`❌ Job ${jobId}: ${job.error}`);
}

// Read cached reel info from upstream — does NOT hit Instagram. Returns whatever
// the most recent scrape stored. Pair this with auto-refresh-on-track so dashboards
// can load instantly without ever waiting for an IG round-trip.
app.get('/api/reel-info', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ success: false, error: 'url query param required' });
    }
    const upRes = await fetch(`${INTERNAL_API_URL}/reel-info?url=${encodeURIComponent(url)}`);
    const data = await upRes.json().catch(() => ({}));
    return res.status(upRes.status).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: `Upstream unreachable: ${e.message}` });
  }
});

// Register reel URLs for the daily trickle refresh. Call this on reel upload
// so the URL gets refreshed automatically once a day (24h interval) even when
// nobody opens the website. Accepts a JSON body { urls: [...] } or repeated
// ?urls=... query params.
app.post('/api/track', async (req, res) => {
  try {
    let urls = [];
    if (Array.isArray(req.body?.urls)) urls = req.body.urls;
    if (typeof req.query.urls === 'string') urls.push(req.query.urls);
    if (Array.isArray(req.query.urls)) urls.push(...req.query.urls);
    urls = urls.filter(u => typeof u === 'string' && u.includes('instagram.com'));
    if (urls.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid Instagram URLs provided' });
    }
    const qs = urls.map(u => `urls=${encodeURIComponent(u)}`).join('&');
    const upRes = await fetch(`${INTERNAL_API_URL}/track?${qs}`, { method: 'POST' });
    const data = await upRes.json().catch(() => ({}));
    return res.status(upRes.status).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: `Upstream unreachable: ${e.message}` });
  }
});

// Bulk-import reels from the payment-tracking Google Sheet (or any external source).
// Uses the service-role Supabase client to upsert reels attributed to each handler's
// email, then auto-tracks each URL upstream so daily trickle refresh picks it up.
//
// Body shape: { reels: [{ url, ownerusername, payout, created_by_email,
//                         created_by_name, locationname?, shortcode? }, ...] }
//
// Optional protection — set IMPORT_REELS_TOKEN in env to require a matching
// X-Import-Token header (so random people on the internet can't insert).
app.post('/api/import-reels', async (req, res) => {
  // Token gate (optional)
  const expected = process.env.IMPORT_REELS_TOKEN;
  if (expected) {
    const provided = req.get('X-Import-Token') || '';
    if (provided !== expected) {
      return res.status(401).json({ success: false, error: 'Invalid or missing X-Import-Token' });
    }
  }
  if (!supabaseAdmin) {
    return res.status(503).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured on server'
    });
  }
  const reels = Array.isArray(req.body?.reels) ? req.body.reels : null;
  if (!reels || reels.length === 0) {
    return res.status(400).json({ success: false, error: 'body.reels[] required' });
  }
  const shortcodeRe = /instagram\.com\/(?:[^/]+\/)?(?:reels?|p)\/([A-Za-z0-9_-]+)/;
  let inserted = 0, updated = 0, errors = 0;
  const errorDetails = [];
  for (const r of reels) {
    try {
      const url = r.url || r.permalink;
      if (!url) { errors++; errorDetails.push({ row: r, err: 'no url' }); continue; }
      let shortcode = r.shortcode;
      if (!shortcode) {
        const m = shortcodeRe.exec(url);
        if (m) shortcode = m[1];
      }
      if (!shortcode) { errors++; errorDetails.push({ row: r, err: 'no shortcode' }); continue; }

      const payload = {
        ownerusername: r.ownerusername || null,
        permalink: url,
        url: url,
        shortcode,
        payout: r.payout == null ? null : Number(r.payout),
        created_by_email: r.created_by_email || null,
        created_by_name: r.created_by_name || null,
        locationname: r.locationname || null,
        updated_at: new Date().toISOString(),
      };

      // Look for an existing row by shortcode (preferred) or url
      const { data: existing, error: lookupErr } = await supabaseAdmin
        .from('reels')
        .select('id, payout')
        .or(`shortcode.eq.${shortcode},url.eq.${url}`)
        .limit(1);
      if (lookupErr) throw lookupErr;

      if (existing && existing.length > 0) {
        const id = existing[0].id;
        // Don't overwrite payout if our incoming value is 0/null (preserve existing data)
        const upd = { ...payload };
        if (payload.payout == null || payload.payout === 0) delete upd.payout;
        const { error: updErr } = await supabaseAdmin.from('reels').update(upd).eq('id', id);
        if (updErr) throw updErr;
        updated++;
      } else {
        const { error: insErr } = await supabaseAdmin.from('reels').insert(payload);
        if (insErr) throw insErr;
        inserted++;
      }

      // Auto-register for daily trickle refresh upstream (best-effort, non-fatal)
      if (INTERNAL_API_URL) {
        fetch(`${INTERNAL_API_URL}/track?urls=${encodeURIComponent(url)}`, { method: 'POST' })
          .catch(() => {});
      }
    } catch (e) {
      errors++;
      errorDetails.push({ shortcode: r.shortcode, err: e.message });
    }
  }

  res.json({ success: true, inserted, updated, errors, errorDetails: errorDetails.slice(0, 10) });
});


// Bulk-update view counts for existing reels (used by bulk_refresh_reels.py).
// Body: { updates: [{ shortcode, videoplaycount, likescount?, commentscount? }, ...] }
app.post('/api/bulk-update-views', async (req, res) => {
  const expected = process.env.IMPORT_REELS_TOKEN;
  if (expected) {
    const provided = req.get('X-Import-Token') || '';
    if (provided !== expected) return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'no service-role client' });
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : null;
  if (!updates || updates.length === 0) return res.status(400).json({ success: false, error: 'body.updates[] required' });

  let applied = 0, errors = 0;
  for (const u of updates) {
    if (!u.shortcode) { errors++; continue; }
    const patch = { lastupdatedat: new Date().toISOString(), refresh_failed: false };
    if (u.videoplaycount != null) patch.videoplaycount = u.videoplaycount;
    if (u.likescount     != null) patch.likescount     = u.likescount;
    if (u.commentscount  != null) patch.commentscount  = u.commentscount;
    if (u.takenat        != null) patch.takenat        = u.takenat;
    try {
      const { error } = await supabaseAdmin.from('reels').update(patch).eq('shortcode', u.shortcode);
      if (error) throw error;
      applied++;
    } catch (e) {
      errors++;
    }
  }
  res.json({ success: true, applied, errors });
});

// Bulk-apply bonus payments to existing reels (additive — adds to existing payout).
// Body shape: { bonuses: [{ ownerusername, amount, shortcode? }, ...] }
app.post('/api/apply-bonuses', async (req, res) => {
  const expected = process.env.IMPORT_REELS_TOKEN;
  if (expected) {
    const provided = req.get('X-Import-Token') || '';
    if (provided !== expected) return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'no service-role client' });
  const bonuses = Array.isArray(req.body?.bonuses) ? req.body.bonuses : null;
  if (!bonuses || bonuses.length === 0) return res.status(400).json({ success: false, error: 'body.bonuses[] required' });
  let applied = 0, missing = 0, errors = 0;
  for (const b of bonuses) {
    try {
      if (!b.ownerusername || !b.amount) { errors++; continue; }
      let q = supabaseAdmin.from('reels').select('id, payout').eq('ownerusername', b.ownerusername);
      if (b.shortcode) q = q.eq('shortcode', b.shortcode);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      if (!data || data.length === 0) { missing++; continue; }
      const newPayout = (Number(data[0].payout) || 0) + Number(b.amount);
      const { error: updErr } = await supabaseAdmin.from('reels').update({ payout: newPayout }).eq('id', data[0].id);
      if (updErr) throw updErr;
      applied++;
    } catch (e) {
      errors++;
    }
  }
  res.json({ success: true, applied, missing, errors });
});


// Snapshot of all tracked reels + last refresh + latest views (handy admin view)
app.get('/api/track', async (req, res) => {
  try {
    const upRes = await fetch(`${INTERNAL_API_URL}/track`);
    const data = await upRes.json().catch(() => ({}));
    return res.status(upRes.status).json(data);
  } catch (e) {
    res.status(502).json({ success: false, error: `Upstream unreachable: ${e.message}` });
  }
});


// Check job status
app.get('/api/async/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobQueue.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  const response = {
    job_id: jobId,
    status: job.status,
    created_at: job.createdAt
  };

  if (job.status === 'completed') {
    response.result = job.result;
  } else if (job.status === 'failed') {
    response.error = job.error;
  }

  res.json(response);
});

app.post('/api/internal/scrape', async (req, res) => {
  try {
    // Accept URL from query params OR body (frontend sends as query param)
    const url = req.query.url || req.body.url;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required. Send as ?url= query param or in request body.' 
      });
    }

    console.log('🌐 Proxying to internal API:', url);
    let response;
    try {
      // Create a timeout promise
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
      });
      
      // Race between fetch and timeout
      const fetchPromise = fetch(`${INTERNAL_API_URL}/scrape?url=${encodeURIComponent(url)}`);
      response = await Promise.race([fetchPromise, timeoutPromise]);
      clearTimeout(timeoutId); // Clear timeout if fetch succeeds
    } catch (fetchError) {
      // Handle network errors (tunnel down, DNS failure, etc.)
      const isNetworkError = 
        fetchError.cause?.code === 'ENOTFOUND' || 
        fetchError.cause?.errno === -3008 ||
        fetchError.message?.includes('fetch failed') ||
        fetchError.message?.includes('ENOTFOUND') ||
        fetchError.name === 'TypeError' ||
        (fetchError.cause && typeof fetchError.cause === 'object' && 'code' in fetchError.cause);
      
      if (isNetworkError) {
        console.error('❌ Network error: Cloudflare tunnel appears to be down or unreachable');
        console.error('   Tunnel URL:', INTERNAL_API_URL);
        console.error('   Error:', fetchError.message);
        console.error('   Error name:', fetchError.name);
        if (fetchError.cause) {
          console.error('   Cause:', fetchError.cause);
          console.error('   Cause code:', fetchError.cause.code);
          console.error('   Cause errno:', fetchError.cause.errno);
        }
        return res.status(503).json({ 
          success: false, 
          error: 'Internal API service unavailable. The Cloudflare tunnel may be down. Please check if the tunnel is running.',
          details: fetchError.message || 'Network connection failed'
        });
      }
      if (fetchError.message?.includes('timeout') || fetchError.message?.includes('Timeout')) {
        return res.status(504).json({ 
          success: false, 
          error: 'Request timeout. The internal API took too long to respond.',
        });
      }
      throw fetchError; // Re-throw other errors
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Internal API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Internal API response received');
    // Log the full response structure for debugging
    if (data.success && data.data) {
      console.log('📦 Response keys:', Object.keys(data.data));
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error in /api/internal/scrape:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const errorDetails = error?.cause ? ` (${error.cause.message || error.cause})` : '';
    console.error('   Error message:', errorMessage);
    console.error('   Error details:', errorDetails);
    res.status(500).json({ 
      success: false, 
      error: errorMessage + errorDetails
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Apify API server running on http://localhost:${PORT}`);
});
