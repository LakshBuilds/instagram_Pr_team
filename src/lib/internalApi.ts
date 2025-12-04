// Internal API service for fetching Instagram data
// This uses your custom scraper API instead of Apify
// Note: The frontend calls the proxy server at localhost:3001, which then proxies to the Internal API

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
  console.log(`🚀 Processing queue (${rateLimitState.queue.length} requests)`);

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

    cleanupRateLimitState();
    const currentCount = rateLimitState.requests.length;
    console.log(`🔄 Processing request ${currentCount + 1}/${RATE_LIMIT} (${rateLimitState.queue.length} remaining in queue)`);

    try {
      const data = await fetchFromInternalApiDirect(item.url);
      item.resolve(data);
    } catch (error) {
      item.reject(error);
    }

    if (rateLimitState.queue.length > 0) {
      const delaySeconds = Math.ceil(REQUEST_DELAY_MS / 1000);
      console.log(`⏸️  Rate limiting: Waiting ${delaySeconds}s before next request (${rateLimitState.queue.length} in queue)`);
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  rateLimitState.processing = false;
}

async function fetchFromInternalApiDirect(instagramUrl: string): Promise<InternalApiResponse> {
  const proxyUrl = 'http://localhost:3001/api/internal/scrape';
  
  console.log(`🌐 Fetching from internal API (via proxy): ${instagramUrl}`);
  
  try {
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
  } catch (error: any) {
    // Check if it's a network error (server not running)
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error('❌ Proxy server not running at localhost:3001. Please start it with: npm run dev:server (or npm run dev:all to run both frontend & server)');
    }
    throw error;
  }
}

export async function fetchFromInternalApi(
  instagramUrl: string,
  priority: number = 0
): Promise<InternalApiResponse> {
  return new Promise((resolve, reject) => {
    cleanupRateLimitState();
    const currentRequests = rateLimitState.requests.length;
    const queueLength = rateLimitState.queue.length;
    
    rateLimitState.queue.push({
      url: instagramUrl,
      priority,
      resolve,
      reject,
    });
    
    console.log(`📥 Queued request (Priority: ${priority}) | Active: ${currentRequests}/${RATE_LIMIT} | Queue: ${queueLength + 1}`);
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
  
  // Get the best available view count (prioritize play_count, then video_view_count, then view_count)
  const viewCount = apiData.engagement.play_count || 
                    apiData.engagement.video_view_count || 
                    apiData.engagement.view_count || 
                    apiData.engagement.organic_video_view_count || 
                    0;
  
  console.log(`👀 Views: play_count=${apiData.engagement.play_count}, video_view_count=${apiData.engagement.video_view_count}, view_count=${apiData.engagement.view_count}, using=${viewCount}`);
  
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
    videoviewcount: viewCount,
    videoplaycount: viewCount,
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
    // is_archived field removed - not in database schema
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
