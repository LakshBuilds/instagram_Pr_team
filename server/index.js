// Express server for Apify API calls (server-side)
// This avoids CORS and bot detection issues

import 'dotenv/config'; // Load .env file
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
const INTERNAL_API_URL = process.env.INTERNAL_API_URL;

if (!INTERNAL_API_URL) {
  console.error('❌ INTERNAL_API_URL not set in .env file!');
  console.error('   Please add: INTERNAL_API_URL=https://your-cloudflare-url.trycloudflare.com');
} else {
  console.log('✅ Internal API URL:', INTERNAL_API_URL);
}

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
    const response = await fetch(`${INTERNAL_API_URL}/scrape?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Internal API error: ${response.status} ${response.statusText}`);
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
