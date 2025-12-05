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

app.post('/api/internal/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
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
      if (fetchError.cause?.code === 'ENOTFOUND' || fetchError.message.includes('fetch failed') || fetchError.cause?.errno === -3008) {
        console.error('❌ Network error: Cloudflare tunnel appears to be down or unreachable');
        console.error('   Tunnel URL:', INTERNAL_API_URL);
        console.error('   Error:', fetchError.message);
        if (fetchError.cause) {
          console.error('   Cause:', fetchError.cause.message);
        }
        return res.status(503).json({ 
          success: false, 
          error: 'Internal API service unavailable. The Cloudflare tunnel may be down. Please check if the tunnel is running.',
          details: fetchError.message
        });
      }
      if (fetchError.message.includes('timeout')) {
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
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Apify API server running on http://localhost:${PORT}`);
});
