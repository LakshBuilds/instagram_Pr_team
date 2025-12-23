// Internal API service for fetching Instagram data
// This uses your custom scraper API with async polling to avoid 504 timeouts

// Backend server URL for production (to avoid CORS)
const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || "";

// Polling configuration
const POLL_INTERVAL_MS = 3000; // 3 seconds between polls
const MAX_POLL_ATTEMPTS = 60; // Max 3 minutes of polling

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

interface AsyncJobResponse {
  job_id: string;
  status: string;
  message?: string;
}

interface AsyncStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: InternalApiResponse;
  error?: string;
  progress?: number;
}

/**
 * Extract video duration from the video URL's efg parameter
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

/**
 * Get the base API URL based on environment
 */
function getApiBaseUrl(): string {
  const isDev = import.meta.env.DEV;
  if (isDev) {
    return ''; // Use Vite proxy
  }
  return API_SERVER_URL || '';
}

/**
 * Submit async scrape job and poll for result
 * This avoids 504 timeout by using async job processing
 */
async function fetchFromInternalApiAsync(
  instagramUrl: string,
  onProgress?: (status: string, progress?: number) => void
): Promise<InternalApiResponse> {
  const baseUrl = getApiBaseUrl();
  
  console.log(`🚀 Submitting async scrape job for: ${instagramUrl}`);
  
  // Step 1: Submit the job
  const submitUrl = `${baseUrl}/api/async/scrape?url=${encodeURIComponent(instagramUrl)}`;
  
  const submitRes = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(`Failed to submit job: ${submitRes.status} - ${errorText}`);
  }
  
  const jobData: AsyncJobResponse = await submitRes.json();
  const jobId = jobData.job_id;
  
  console.log(`📋 Job submitted with ID: ${jobId}`);
  onProgress?.('Job submitted, waiting for processing...', 0);
  
  // Step 2: Poll for result
  let attempts = 0;
  
  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;
    
    // Wait before polling
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    
    const statusUrl = `${baseUrl}/api/async/status/${jobId}`;
    const statusRes = await fetch(statusUrl);
    
    if (!statusRes.ok) {
      console.warn(`⚠️ Status check failed (attempt ${attempts}), retrying...`);
      continue;
    }
    
    const status: AsyncStatusResponse = await statusRes.json();
    
    console.log(`📊 Job status: ${status.status} (attempt ${attempts}/${MAX_POLL_ATTEMPTS})`);
    onProgress?.(status.status, status.progress);
    
    if (status.status === 'completed' && status.result) {
      console.log(`✅ Job completed successfully!`);
      return status.result;
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error || 'Job failed without error message');
    }
    
    // Continue polling for 'pending' or 'processing' status
  }
  
  throw new Error(`Job timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000} seconds`);
}

/**
 * Fallback to direct API call (for backwards compatibility)
 */
async function fetchFromInternalApiDirect(instagramUrl: string): Promise<InternalApiResponse> {
  const baseUrl = getApiBaseUrl();
  const apiUrl = `${baseUrl}/api/internal/scrape`;
  
  console.log(`🌐 Direct fetch from: ${instagramUrl}`);
  
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

  return data;
}

/**
 * Main function to fetch from internal API
 * Uses async polling by default to avoid 504 timeouts
 */
export async function fetchFromInternalApi(
  instagramUrl: string,
  options?: {
    useAsync?: boolean;
    onProgress?: (status: string, progress?: number) => void;
  }
): Promise<InternalApiResponse> {
  const useAsync = options?.useAsync ?? true; // Default to async
  
  if (useAsync) {
    try {
      return await fetchFromInternalApiAsync(instagramUrl, options?.onProgress);
    } catch (error) {
      console.warn('⚠️ Async API failed, falling back to direct call:', error);
      // Fallback to direct call if async fails
      return fetchFromInternalApiDirect(instagramUrl);
    }
  }
  
  return fetchFromInternalApiDirect(instagramUrl);
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
  // Rate limiting is now handled by the internal API server
  return {
    requestsInWindow: 0,
    limit: 'Handled by server',
    queueLength: 0,
    canMakeRequest: true,
    nextAvailableIn: 0,
  };
}
