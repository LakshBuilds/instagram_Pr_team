// Internal API service for fetching Instagram data
// This uses your custom scraper API instead of Apify

const INTERNAL_API_URL = import.meta.env.VITE_INTERNAL_API_URL || "https://ruby-richards-meant-mix.trycloudflare.com";

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
    // Video duration fields (may be in different locations)
    video_duration?: number;
    duration?: number;
    videoDuration?: number;
  };
  shortcode: string;
  filename: string | null;
}

/**
 * Clean up old requests from rate limit tracking
 */
function cleanupRateLimitState() {
  const now = Date.now();
  rateLimitState.requests = rateLimitState.requests.filter(
    time => now - time < RATE_WINDOW_MS
  );
}

/**
 * Check if we can make a request now
 */
function canMakeRequest(): boolean {
  cleanupRateLimitState();
  return rateLimitState.requests.length < RATE_LIMIT;
}

/**
 * Process the queue with rate limiting
 */
async function processQueue() {
  if (rateLimitState.processing || rateLimitState.queue.length === 0) {
    return;
  }

  rateLimitState.processing = true;

  while (rateLimitState.queue.length > 0) {
    if (!canMakeRequest()) {
      // Wait until we can make another request
      const oldestRequest = rateLimitState.requests[0];
      const waitTime = RATE_WINDOW_MS - (Date.now() - oldestRequest);
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
      cleanupRateLimitState();
    }

    // Sort queue by priority (higher = more important)
    rateLimitState.queue.sort((a, b) => b.priority - a.priority);
    const item = rateLimitState.queue.shift();
    
    if (!item) break;

    try {
      const data = await fetchFromInternalApiDirect(item.url);
      item.resolve(data);
    } catch (error) {
      item.reject(error);
    }

    // Add delay between requests
    if (rateLimitState.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  rateLimitState.processing = false;
}

/**
 * Direct fetch from internal API via backend proxy (to avoid CORS)
 */
async function fetchFromInternalApiDirect(instagramUrl: string): Promise<InternalApiResponse> {
  // Use backend proxy to avoid CORS issues
  const proxyUrl = 'http://localhost:3001/api/internal/scrape';
  
  console.log(`🌐 Fetching from internal API (via proxy): ${instagramUrl}`);
  
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: instagramUrl }),
  });
  
  if (!response.ok) {
    throw new Error(`Internal API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Internal API returned error for ${instagramUrl}`);
  }

  rateLimitState.requests.push(Date.now());
  return data;
}

/**
 * Fetch from internal API with rate limiting and priority queue
 * @param instagramUrl - Instagram reel URL
 * @param priority - Higher priority = processed first (default: 0, import: 10)
 */
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
 */
export function transformInternalApiToReel(data: InternalApiResponse, inputUrl: string) {
  const apiData = data.data;
  
  // Extract video duration from various possible locations
  const videoDuration = apiData.video_duration || apiData.duration || apiData.videoDuration || null;
  
  // Convert timestamp to ISO date string for takenat (date of posting)
  const takenAt = apiData.timestamp 
    ? new Date(apiData.timestamp * 1000).toISOString()
    : null;
  
  // Only include fields that exist in the Supabase reels table
  return {
    shortcode: apiData.shortcode,
    ownerusername: apiData.user.username,
    ownerfullname: apiData.user.full_name,
    ownerid: null,
    caption: apiData.caption || "",
    likescount: apiData.engagement.like_count,
    commentscount: apiData.engagement.comment_count,
    videoviewcount: apiData.engagement.play_count,
    videoplaycount: apiData.engagement.play_count, // Use play_count as views
    timestamp: takenAt,
    takenat: takenAt, // Date of posting
    video_duration: videoDuration, // Video duration in seconds
    displayurl: apiData.thumbnail_urls[0]?.url || null,
    videourl: apiData.video_urls[0]?.url || null,
    thumbnailurl: apiData.thumbnail_urls[0]?.url || null,
    producttype: "clips",
    url: `https://www.instagram.com/p/${apiData.shortcode}/`,
    permalink: `https://www.instagram.com/p/${apiData.shortcode}/`,
    inputurl: inputUrl,
  };
}

/**
 * Get current rate limit status
 */
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

