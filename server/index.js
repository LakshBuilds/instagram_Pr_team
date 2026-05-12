// Express server for Apify API calls (server-side)
// This avoids CORS and bot detection issues

import dotenv from 'dotenv';
// Load .env file - dotenv will auto-detect .env in project root
dotenv.config();
console.log('🔍 INTERNAL_API_URL:', process.env.INTERNAL_API_URL || 'NOT SET');
import express from 'express';
import cors from 'cors';
import { fetchReelFromApify, fetchReelsFromApify } from './api/apify.js';

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
