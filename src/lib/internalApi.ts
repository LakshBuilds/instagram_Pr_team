// Internal API service for fetching Instagram data
// This uses your custom scraper API instead of Apify

// Cloudflare tunnel URL (used by the backend proxy server)
const INTERNAL_API_URL = import.meta.env.VITE_INTERNAL_API_URL || "https://strips-ministries-informal-examining.trycloudflare.com";

// Backend server URL for production (to avoid CORS)
// In dev: uses Vite proxy, In prod: uses this URL
const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || "";

// Rate limiting configuration
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_DELAY_MS = (RATE_WINDOW_MS / RATE_LIMIT); // ~15 seconds between requests

interface RateLimitState {
  requests: number[];
  queue: Array<{ url: string; priority: number; resolve: Function; reject: Function }>;
  processing: boolean;
}

const rateLimitState: RateLimitState = {
  requests: [],
  queue: [],
  processing: false,
};

// Internal API response format
interface InternalApiResponse {
  success: boolean;
  data: {
    shortcode: string;
    video_urls: Array<{
      url: string;
      width: number;
      height: number;
      type: number;
    }>;
    thumbnail_urls: Array<{
      url: string;
      width: number;
      height: number;
    }>;
    engagement: {
      like_count: number;
      comment_count: number;
      play_count: number;
      view_count: number | null;
      video_view_count: number | null;
      organic_video_view_count: number | null;
    };
    user: {
      username: string;
      full_name: string;
      profile_pic_url: string;
      is_verified: boolean;
      is_private: boolean;
    };
    caption: string;
    timestamp: number;
    video_duration?: number;
    duration?: number;
    videoDuration?: number;
  };
  shortcode: string;
  filename: string | null;
}

/**
 * Extract video duration from the video URL's efg parameter
 * The efg parameter contains base64 encoded JSON with "duration_s" field
 */
function extractVideoDurationFromUrl(videoUrl: string | null): number | null {
  if (!videoUrl) return null;
  
  try {
    const url = new URL(videoUrl);
    const efg = url.searchParams.get('efg');
    
    if (efg) {
      const decoded = atob(efg);
      const data = JSON.parse(decoded);
      if (data.duration_s) {
        return Math.round(data.duration_s);
      }
    }
  } catch (e) {
    const match = videoUrl.match(/"duration_s":(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

function cleanupRateLimitState() {
  const now = Date.now();
  rateLimitState.requests = rateLimitState.requests.filter(
    time => now - time < RATE_WINDOW_MS
  );
}

function canMakeRequest(): boolean {
  cleanupRateLimitState();
  return rateLimitState.requests.length < RATE_LIMIT;
}

async function processQueue() {
  if (rateLimitState.processing || rateLimitState.queue.length === 0) {
    return;
  }

  rateLimitState.processing = true;

  while (rateLimitState.queue.length > 0) {
    if (!canMakeRequest()) {
      const oldestRequest = rateLimitState.requests[0];
      const waitTime = RATE_WINDOW_MS - (Date.now() - oldestRequest);
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
      cleanupRateLimitState();
    }

    rateLimitState.queue.sort((a, b) => b.priority - a.priority);
    const item = rateLimitState.queue.shift();
    
    if (!item) break;

    try {
      const data = await fetchFromInternalApiDirect(item.url);
      item.resolve(data);
    } catch (error) {
      item.reject(error);
    }

    if (rateLimitState.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  rateLimitState.processing = false;
}

async function fetchFromInternalApiDirect(instagramUrl: string): Promise<InternalApiResponse> {
  // Use Vite proxy in dev, backend server in prod (to avoid CORS)
  // In dev: /api/internal/scrape -> Vite proxies to Cloudflare tunnel
  // In prod: API_SERVER_URL/api/internal/scrape -> Express server proxies to Cloudflare tunnel
  const isDev = import.meta.env.DEV;
  
  let apiUrl: string;
  if (isDev) {
    // Development: use Vite proxy
    apiUrl = '/api/internal/scrape';
  } else if (API_SERVER_URL) {
    // Production with backend server: use the server's proxy endpoint
    apiUrl = `${API_SERVER_URL}/api/internal/scrape`;
  } else {
    // Fallback: direct call (will fail due to CORS in browser)
    apiUrl = `${INTERNAL_API_URL}/scrape`;
  }
  
  console.log(`🌐 Fetching from internal API: ${instagramUrl}`);
  console.log(`📡 API endpoint: ${apiUrl}?url=... (dev mode: ${isDev})`);
  
  try {
    // API expects URL as query parameter
    const fullUrl = `${apiUrl}?url=${encodeURIComponent(instagramUrl)}`;
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Internal API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || `Internal API returned error for ${instagramUrl}`);
    }

    rateLimitState.requests.push(Date.now());
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const targetUrl = isDev ? 'Vite proxy -> ' + INTERNAL_API_URL : (API_SERVER_URL || INTERNAL_API_URL);
      throw new Error(`❌ Cannot connect to API (${targetUrl}). The server may be down or unreachable.`);
    }
    throw error;
  }
}

export async function fetchFromInternalApi(
  instagramUrl: string,
  priority: number = 0
): Promise<InternalApiResponse> {
  return new Promise((resolve, reject) => {
    rateLimitState.queue.push({
      url: instagramUrl,
      priority,
      resolve,
      reject,
    });
    processQueue();
  });
}

/**
 * Transform internal API response to our reel format
 * - takenat: Date of posting (from timestamp)
 * - video_duration: Duration in seconds
 */
export function transformInternalApiToReel(data: InternalApiResponse, inputUrl: string) {
  const apiData = data.data;
  
  const videoUrl = apiData.video_urls[0]?.url || null;
  
  // Video duration from API or extracted from URL
  const videoDuration = 
    apiData.video_duration || 
    apiData.duration || 
    apiData.videoDuration || 
    extractVideoDurationFromUrl(videoUrl);
  
  // Convert Unix timestamp (seconds) to ISO date string
  const takenAt = apiData.timestamp 
    ? new Date(apiData.timestamp * 1000).toISOString()
    : null;
  
  console.log(`📅 Date of posting (takenat): ${takenAt} from timestamp: ${apiData.timestamp}`);
  console.log(`⏱️ Video duration: ${videoDuration}s`);
  
  const resolvedId = `shortcode_${apiData.shortcode}`;
  
  return {
    id: resolvedId,
    shortcode: apiData.shortcode,
    ownerusername: apiData.user.username,
    ownerfullname: apiData.user.full_name,
    ownerid: null,
    caption: apiData.caption || "",
    likescount: apiData.engagement.like_count,
    commentscount: apiData.engagement.comment_count,
    videoviewcount: apiData.engagement.play_count,
    videoplaycount: apiData.engagement.play_count,
    timestamp: takenAt,
    takenat: takenAt,
    video_duration: videoDuration,
    displayurl: apiData.thumbnail_urls[0]?.url || null,
    videourl: videoUrl,
    thumbnailurl: apiData.thumbnail_urls[0]?.url || null,
    producttype: "clips",
    url: `https://www.instagram.com/p/${apiData.shortcode}/`,
    permalink: `https://www.instagram.com/p/${apiData.shortcode}/`,
    inputurl: inputUrl,
    is_archived: false,
  };
}

export function getRateLimitStatus() {
  cleanupRateLimitState();
  return {
    requestsInWindow: rateLimitState.requests.length,
    limit: RATE_LIMIT,
    queueLength: rateLimitState.queue.length,
    canMakeRequest: canMakeRequest(),
    nextAvailableIn: rateLimitState.requests.length >= RATE_LIMIT
      ? Math.max(0, RATE_WINDOW_MS - (Date.now() - rateLimitState.requests[0]))
      : 0,
  };
}
