// Apify API service for fetching Instagram data
import { supabase } from "@/integrations/supabase/client";

const APIFY_API_URL = import.meta.env.VITE_APIFY_API_URL || "https://api.apify.com/v2/datasets/lIDsBnEZjl7drDU7b/items";
const DEFAULT_APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || "";
const APIFY_ACTOR_ID = "shu8hvrXbJbY3Eb9W"; // Instagram scraper actor ID

// Type definitions based on Apify API response and Instagram API
export interface ApifyInstagramPost {
  id?: string;
  type?: string;
  shortCode?: string;
  code?: string; // Alternative shortcode field
  // Support caption as both string and object with text property
  caption?: string | {
    text?: string;
  };
  hashtags?: string[];
  mentions?: string[];
  url: string;
  commentsCount?: number;
  comment_count?: number; // Alternative field name
  firstComment?: string;
  latestComments?: Array<{
    id: string;
    text: string;
    ownerUsername: string;
    timestamp: string;
    likesCount: number;
  }>;
  dimensionsHeight?: number;
  dimensionsWidth?: number;
  displayUrl?: string;
  display_uri?: string; // Alternative field name
  images?: string[];
  alt?: string;
  likesCount?: number;
  like_count?: number; // Alternative field name
  timestamp?: string;
  taken_at?: string; // Alternative field name
  childPosts?: any[];
  ownerFullName?: string;
  ownerUsername?: string;
  ownerId?: string;
  isCommentsDisabled?: boolean;
  inputUrl?: string;
  inputurl?: string; // Alternative field name
  isSponsored?: boolean;
  // Support both camelCase and snake_case field names
  videoviewcount?: number;
  videoplaycount?: number;
  videoViewCount?: number; // camelCase from API
  videoPlayCount?: number; // camelCase from API
  play_count?: number; // Alternative field name
  // Apify dataset fields (camelCase)
  videoUrl?: string; // Direct video URL from Apify
  audioUrl?: string; // Direct audio URL from Apify
  videoDuration?: number; // Video duration from Apify
  taggedUsers?: any; // Tagged users from Apify
  musicInfo?: any; // Music info from Apify
  locationName?: string; // Location name from Apify
  locationId?: string; // Location ID from Apify
  productType?: string; // Product type from Apify
  isSponsored?: boolean; // Is sponsored post
  // New Instagram API fields
  is_post_live_clips_media?: boolean;
  video_duration?: number;
  has_audio?: boolean;
  has_tagged_users?: boolean;
  original_width?: number;
  original_height?: number;
  user?: {
    full_name?: string;
    username?: string;
    is_private?: boolean;
    is_verified?: boolean;
    profile_pic_url?: string;
  };
  video_versions?: Array<{
    url?: string;
    width?: number;
    height?: number;
  }>;
  clips_metadata?: {
    music_info?: any;
    original_sound_info?: {
      progressive_download_url?: string;
      duration_in_ms?: number;
      ig_artist?: {
        username?: string;
        full_name?: string;
        is_private?: boolean;
        is_verified?: boolean;
        profile_pic_url?: string;
      };
    };
  };
  usertags?: any;
  // Error response fields
  error?: string;
  errorDescription?: string;
}

// Transform Apify data to match Supabase reels schema
export interface TransformedReel {
  id: string;
  shortcode: string;
  ownerusername: string;
  ownerfullname: string;
  ownerid: string;
  caption: string;
  likescount: number;
  commentscount: number;
  videoviewcount: number;
  videoplaycount: number;
  timestamp: string;
  takenat: string;
  displayurl: string;
  url: string;
  permalink: string;
  inputurl: string;
  is_archived: boolean;
  language?: string;
  // New Instagram API fields
  is_post_live_clips_media?: boolean;
  video_duration?: number;
  has_audio?: boolean;
  has_tagged_users?: boolean;
  original_width?: number;
  original_height?: number;
  owner_is_private?: boolean;
  owner_is_verified?: boolean;
  owner_profile_pic_url?: string;
  music_info?: any;
  original_sound_info?: any;
  usertags?: any;
  videourl?: string;
  audiourl?: string;
}

/**
 * Triggers an Apify actor run with a URL and waits for completion
 * @param url - Instagram reel URL to scrape
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 * @returns The run object with dataset ID
 */
export const triggerApifyActorRun = async (url: string, apiKey?: string): Promise<{ runId: string; defaultDatasetId: string }> => {
  const token = apiKey || DEFAULT_APIFY_TOKEN;
  const normalizedUrl = normalizeInstagramUrl(url);
  
  console.log("=== Starting Apify Actor Run ===");
  console.log("Original URL:", url);
  console.log("Normalized URL:", normalizedUrl);
  console.log("Actor ID:", APIFY_ACTOR_ID);
  console.log("Using API key:", token.substring(0, 20) + "...");
  
  const inputBody = {
    startUrls: [{ url: normalizedUrl }],
  };
  
  console.log("Actor run input:", JSON.stringify(inputBody, null, 2));
  
  const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(inputBody),
  });

  console.log("Run response status:", runResponse.status, runResponse.statusText);

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    console.error("Failed to start actor run:", errorText);
    throw new Error(`Failed to start Apify actor run: ${errorText}`);
  }

  const runData = await runResponse.json();
  console.log("Run data:", JSON.stringify(runData, null, 2));
  
  const runId = runData.data.id;
  const defaultDatasetId = runData.data.defaultDatasetId;

  if (!runId || !defaultDatasetId) {
    console.error("Missing run ID or dataset ID:", { runId, defaultDatasetId });
    throw new Error("Failed to get run ID or dataset ID from Apify");
  }

  console.log("Run ID:", runId);
  console.log("Dataset ID:", defaultDatasetId);
  console.log("Initial status:", runData.data.status);

  // Poll for run completion
  let status = runData.data.status;
  let attempts = 0;
  const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)

  while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    status = statusData.data.status;
    attempts++;
    console.log(`Polling attempt ${attempts}/${maxAttempts}: Status = ${status}`);
  }

  console.log("Final status:", status);

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify actor run ${status.toLowerCase()}. Run ID: ${runId}`);
  }

  console.log("=== Actor Run Completed Successfully ===");
  return { runId, defaultDatasetId };
};

/**
 * Fetches dataset items from a specific Apify dataset
 * Simple GET request to the dataset URL
 * @param datasetId - The dataset ID to fetch from
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 */
export const fetchApifyDatasetItems = async (datasetId: string, apiKey?: string): Promise<ApifyInstagramPost[]> => {
  const token = apiKey || DEFAULT_APIFY_TOKEN;
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
  
  console.log("Fetching from:", url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch: ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  const items = Array.isArray(data) ? data : [data];
  
  // Filter out null/undefined and return all items (including errors - they'll be handled)
  return items.filter(item => item !== null && item !== undefined);
};

/**
 * Fetches Instagram posts from Apify API (legacy - uses default dataset)
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 */
export const fetchApifyData = async (apiKey?: string): Promise<ApifyInstagramPost[]> => {
  try {
    const token = apiKey || DEFAULT_APIFY_TOKEN;
    const response = await fetch(`${APIFY_API_URL}?token=${token}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    
    const data = await response.json();
    const items = Array.isArray(data) ? data : [data];
    
    // Return items as-is (including error responses)
    return items;
  } catch (error) {
    console.error("Error fetching Apify data:", error);
    throw error;
  }
};

/**
 * Triggers an Apify actor run with multiple URLs and waits for completion
 * @param urls - Array of Instagram reel URLs to scrape
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 * @returns The run object with dataset ID
 */
export const triggerApifyActorRunBulk = async (urls: string[], apiKey?: string): Promise<{ runId: string; defaultDatasetId: string }> => {
  const token = apiKey || DEFAULT_APIFY_TOKEN;
  
  // Start the actor run with multiple URLs as input
  const startUrls = urls.map(url => ({ url }));
  
  const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startUrls: startUrls,
    }),
  });

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Failed to start Apify actor run: ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  const defaultDatasetId = runData.data.defaultDatasetId;

  if (!runId || !defaultDatasetId) {
    throw new Error("Failed to get run ID or dataset ID from Apify");
  }

  // Poll for run completion
  let status = runData.data.status;
  let attempts = 0;
  const maxAttempts = 120; // Wait up to 10 minutes for bulk runs (120 * 5 seconds)

  while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    status = statusData.data.status;
    attempts++;
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify actor run ${status.toLowerCase()}. Run ID: ${runId}`);
  }

  return { runId, defaultDatasetId };
};

/**
 * Fetches Instagram reel data by triggering an Apify actor run with a URL
 * Uses run-sync endpoint which waits for completion automatically
 * @param url - Instagram reel URL to scrape
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 */
/**
 * Normalizes Instagram URL to ensure proper format
 * Removes query parameters and hash fragments that might cause issues
 */
const normalizeInstagramUrl = (url: string): string => {
  try {
    let normalized = url.trim();
    
    // Ensure it's a full URL
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    
    // Parse URL to remove query parameters and hash
    const urlObj = new URL(normalized);
    
    // Remove all query parameters (like ?igsh=...)
    urlObj.search = '';
    // Remove hash fragments
    urlObj.hash = '';
    
    // Reconstruct the URL
    normalized = urlObj.toString();
    
    // Remove trailing slashes (but keep the path)
    normalized = normalized.replace(/\/+$/, '');
    
    // Ensure we have the correct format for reels/posts
    // Convert /p/ to /reel/ if it's actually a reel (this is handled by the API)
    // Just ensure the URL is clean
    
    console.log("URL normalization:", url, "->", normalized);
    return normalized;
  } catch (e) {
    console.warn("Error normalizing URL:", url, e);
    // Fallback: just remove query params and hash with regex
    return url.trim()
      .replace(/\?.*$/, '') // Remove query params
      .replace(/#.*$/, '') // Remove hash
      .replace(/\/+$/, ''); // Remove trailing slashes
  }
};

// Server-side API endpoint (avoids CORS and bot detection)
const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';

export const fetchReelFromApify = async (url: string, apiKey?: string): Promise<ApifyInstagramPost[]> => {
  console.log("Calling server-side API for Apify...");
  
  const response = await fetch(`${API_SERVER_URL}/api/apify/reel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, apiKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Server error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * Fetches multiple Instagram reels by triggering an Apify actor run with URLs
 * Uses run-sync endpoint which waits for completion automatically
 * @param urls - Array of Instagram reel URLs to scrape
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 */
export const fetchReelsFromApify = async (urls: string[], apiKey?: string): Promise<ApifyInstagramPost[]> => {
  console.log("Calling server-side API for bulk Apify...");
  
  const response = await fetch(`${API_SERVER_URL}/api/apify/reels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls, apiKey }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Server error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
};

/**
 * Transforms Apify Instagram post data to match Supabase reels schema
 * Handles error responses by marking as archived and zeroing all counts
 */
export const transformApifyToReel = (post: ApifyInstagramPost): TransformedReel => {
  // Check if this is an error response (restricted page, no_items, etc.)
  const isArchived = !!(post.error || post.errorDescription);
  
  // Extract shortcode from URL if available
  const extractShortcode = (url: string): string => {
    if (!url) return "";
    // Try to extract from various URL formats
    const match = url.match(/\/p\/([^\/\?]+)/) || 
                  url.match(/\/reel\/([^\/\?]+)/) ||
                  url.match(/\/p\/([A-Za-z0-9_-]+)/) ||
                  url.match(/\/reel\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : "";
  };

  // Handle both camelCase and snake_case field names from API
  const videoViewCount = post.videoViewCount ?? post.videoviewcount ?? 0;
  const videoPlayCount = post.videoPlayCount ?? post.videoplaycount ?? post.play_count ?? 0;

  // Extract shortcode - prioritize post.shortCode/code, then extract from URL
  const shortcode = post.shortCode || post.code || extractShortcode(post.url || post.inputUrl || post.inputurl || "");
  
  // Extract caption - handle both string and object formats
  const captionText = typeof post.caption === 'string' 
    ? post.caption 
    : (post.caption?.text || "");
  
  // Extract user info - handle both nested user object and flat fields
  const ownerFullName = post.user?.full_name || post.ownerFullName || "";
  const ownerUsername = post.user?.username || post.ownerUsername || "";
  const ownerId = post.ownerId || "";
  const ownerIsPrivate = post.user?.is_private || false;
  const ownerIsVerified = post.user?.is_verified || false;
  const ownerProfilePicUrl = post.user?.profile_pic_url || "";
  
  // Extract video URL - check multiple sources
  const videoUrl = post.videoUrl || post.video_versions?.[0]?.url || "";
  
  // Extract audio URL - check multiple sources
  const audioUrl = post.audioUrl || post.clips_metadata?.original_sound_info?.progressive_download_url || "";
  
  // Extract video duration - check multiple sources
  const videoDuration = post.videoDuration || post.video_duration || null;
  
  // Extract tagged users - check multiple sources
  const taggedUsers = post.taggedUsers || post.usertags || null;
  
  // Extract music info - check multiple sources
  const musicInfo = post.musicInfo || post.clips_metadata?.music_info || null;
  
  // Extract location - check multiple sources
  const locationName = post.locationName || null;
  
  // Extract display URL - handle both field names
  const displayUrl = post.displayUrl || post.display_uri || "";
  
  // Extract timestamp - handle both field names
  const timestamp = post.timestamp || post.taken_at || new Date().toISOString();
  
  // Extract counts - handle both field name formats
  const likesCount = post.likesCount || post.like_count || 0;
  const commentsCount = post.commentsCount || post.comment_count || 0;

  // For error responses, try to extract shortcode from inputUrl if available
  const finalShortcode = isArchived && !shortcode && (post.inputUrl || post.inputurl)
    ? extractShortcode(post.inputUrl || post.inputurl || "") 
    : shortcode;

  // Normalize URLs - remove query params
  const normalizeUrl = (url: string): string => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      urlObj.search = "";
      urlObj.hash = "";
      return urlObj.toString().replace(/\/+$/, '');
    } catch {
      return url.replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '');
    }
  };

  const cleanUrl = normalizeUrl(post.url || "");
  const cleanInputUrl = normalizeUrl(post.inputUrl || post.inputurl || post.url || "");
  const cleanPermalink = cleanUrl || cleanInputUrl;

  const resolvedId =
    post.id ||
    (finalShortcode ? `shortcode_${finalShortcode}` : undefined) ||
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2);

  return {
    id: resolvedId,
    shortcode: finalShortcode || "",
    ownerusername: ownerUsername,
    ownerfullname: ownerFullName,
    ownerid: ownerId,
    caption: isArchived ? `[Archived - ${post.errorDescription || post.error || "Restricted"}]` : captionText,
    // Zero all counts if archived
    likescount: isArchived ? 0 : likesCount,
    commentscount: isArchived ? 0 : commentsCount,
    videoviewcount: isArchived ? 0 : videoViewCount,
    videoplaycount: isArchived ? 0 : videoPlayCount,
    timestamp: timestamp,
    takenat: timestamp,
    displayurl: displayUrl,
    url: cleanUrl,
    permalink: cleanPermalink,
    inputurl: cleanInputUrl,
    is_archived: isArchived,
    // language field removed - not in database schema
    // New Instagram API fields
    is_post_live_clips_media: post.is_post_live_clips_media || false,
    video_duration: videoDuration,
    has_audio: post.has_audio || (audioUrl ? true : false),
    has_tagged_users: post.has_tagged_users || (taggedUsers ? true : false),
    original_width: post.original_width || post.dimensionsWidth || post.video_versions?.[0]?.width || null,
    original_height: post.original_height || post.dimensionsHeight || post.video_versions?.[0]?.height || null,
    owner_is_private: ownerIsPrivate,
    owner_is_verified: ownerIsVerified,
    owner_profile_pic_url: ownerProfilePicUrl,
    music_info: musicInfo,
    original_sound_info: post.clips_metadata?.original_sound_info || null,
    usertags: taggedUsers,
    videourl: videoUrl,
    audiourl: audioUrl,
    locationname: locationName,
  };
};

/**
 * Fetches and transforms all Instagram posts from Apify
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 */
export const fetchAndTransformApifyData = async (apiKey?: string): Promise<TransformedReel[]> => {
  const posts = await fetchApifyData(apiKey);
  return posts.map(transformApifyToReel);
};

/**
 * Saves transformed reels to Supabase
 */
export const saveReelsToSupabase = async (
  reels: TransformedReel[],
  userInfo: { id: string; email: string; fullName: string }
): Promise<{ success: number; errors: number; errorDetails?: string[] }> => {
  let success = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const reel of reels) {
    try {
      // Check if reel already exists by permalink, url, or shortcode
      const identifier = reel.permalink || reel.url || reel.shortcode;
      if (!identifier) {
        const errorMsg = "Skipping reel without identifier";
        console.warn(errorMsg, reel);
        errors++;
        errorDetails.push(errorMsg);
        continue;
      }

      // Try to find existing reel by permalink, url, or inputurl
      let existing = null;
      let existingId = null;
      
      // First try by permalink
      if (reel.permalink) {
        const { data: permalinkMatch } = await supabase
          .from("reels")
          .select("id, permalink, url, inputurl, shortcode, videoplaycount, likescount, commentscount")
          .eq("permalink", reel.permalink)
          .maybeSingle();
        if (permalinkMatch) {
          existing = permalinkMatch;
          existingId = permalinkMatch.id;
        }
      }
      
      // If not found, try by url
      if (!existing && reel.url) {
        const { data: urlMatch } = await supabase
          .from("reels")
          .select("id, permalink, url, inputurl, shortcode, videoplaycount, likescount, commentscount")
          .eq("url", reel.url)
          .maybeSingle();
        if (urlMatch) {
          existing = urlMatch;
          existingId = urlMatch.id;
        }
      }
      
      // If still not found, try by inputurl
      if (!existing && reel.inputurl) {
        const { data: inputUrlMatch } = await supabase
          .from("reels")
          .select("id, permalink, url, inputurl, shortcode, videoplaycount, likescount, commentscount")
          .eq("inputurl", reel.inputurl)
          .maybeSingle();
        if (inputUrlMatch) {
          existing = inputUrlMatch;
          existingId = inputUrlMatch.id;
        }
      }
      
      // If still not found, try by shortcode (most reliable for matching)
      if (!existing && reel.shortcode) {
        const { data: shortcodeMatches } = await supabase
          .from("reels")
          .select("id, permalink, url, inputurl, shortcode, videoplaycount, likescount, commentscount")
          .eq("shortcode", reel.shortcode)
          .limit(1);
        if (shortcodeMatches && shortcodeMatches.length > 0) {
          existing = shortcodeMatches[0];
          existingId = shortcodeMatches[0].id;
          // Log if we found a match by shortcode
          const oldViews = shortcodeMatches[0].videoplaycount || 0;
          const newViews = reel.videoplaycount || 0;
          if (oldViews !== newViews) {
            console.log(`🔄 Matching by shortcode ${reel.shortcode}: views ${oldViews} → ${newViews}`);
          }
        }
      }
      
      // If still not found, try fuzzy matching by URL parts
      if (!existing && (reel.permalink || reel.url)) {
        const searchUrl = reel.permalink || reel.url || "";
        const urlParts = searchUrl.split('/').filter(p => p.length > 0);
        const lastPart = urlParts[urlParts.length - 1];
        
        if (lastPart && lastPart.length > 5) {
          // Try to find by URL containing the last part (shortcode-like)
          const { data: fuzzyMatches } = await supabase
            .from("reels")
            .select("id, permalink, url, inputurl, shortcode")
            .or(`permalink.ilike.%${lastPart}%,url.ilike.%${lastPart}%,inputurl.ilike.%${lastPart}%`)
            .limit(1);
          if (fuzzyMatches && fuzzyMatches.length > 0) {
            existing = fuzzyMatches[0];
            existingId = fuzzyMatches[0].id;
            console.log(`🔍 Fuzzy matched by URL part: ${lastPart}`);
          }
        }
      }

      if (existing && existingId) {
        // Log what we're updating
        const oldData = existing;
        console.log(`📝 Updating reel ID ${existingId}:`, {
          shortcode: reel.shortcode,
          oldViews: oldData.videoplaycount || 0,
          newViews: reel.videoplaycount || 0,
          oldLikes: oldData.likescount || 0,
          newLikes: reel.likescount || 0,
        });
        
        // Update existing reel (including archived status)
        // Make sure we're updating all the important fields
        const updateData = {
          ...reel,
          // language field removed - not in database schema
          updated_at: new Date().toISOString(),
          // Explicitly set these fields to ensure they update
          videoplaycount: reel.videoplaycount,
          videoviewcount: reel.videoviewcount,
          likescount: reel.likescount,
          commentscount: reel.commentscount,
          displayurl: reel.displayurl,
          videourl: reel.videourl,
          audiourl: reel.audiourl,
          video_duration: reel.video_duration,
          has_audio: reel.has_audio,
          has_tagged_users: reel.has_tagged_users,
          locationname: reel.locationname,
        };
        
        const { error } = await supabase
          .from("reels")
          .update(updateData)
          .eq("id", existingId);

        if (error) {
          const errorMsg = `Error updating reel ${identifier}: ${error.message}`;
          console.error(errorMsg, error);
          errors++;
          errorDetails.push(errorMsg);
        } else {
          success++;
          console.log(`✅ Updated reel: ${identifier}`);
          if (reel.is_archived) {
            console.log(`Marked reel as archived: ${identifier}`);
          }
        }
      } else {
        // Insert new reel (including archived status)
        // Ensure language is set to Hinglish if not provided
        const { error } = await supabase.from("reels").insert({
          ...reel,
          // language field removed - not in database schema
          created_by_user_id: userInfo.id,
          created_by_email: userInfo.email,
          created_by_name: userInfo.fullName,
        });

        if (error) {
          const errorMsg = `Error inserting reel ${identifier}: ${error.message}`;
          console.error(errorMsg, error);
          errors++;
          errorDetails.push(errorMsg);
        } else {
          success++;
          if (reel.is_archived) {
            console.log(`Inserted archived reel: ${identifier}`);
          }
        }
      }
    } catch (error: any) {
      const errorMsg = `Unexpected error processing reel: ${error?.message || error}`;
      console.error(errorMsg, error);
      errors++;
      errorDetails.push(errorMsg);
    }
  }

  return { success, errors, errorDetails: errorDetails.length > 0 ? errorDetails : undefined };
};

/**
 * Fetches from Apify and saves to Supabase in one operation
 * @param user - The authenticated user
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 * @param profile - Optional user profile data
 */
export const importApifyDataToSupabase = async (
  userInfo: { id: string; email: string; fullName: string },
  apiKey?: string
): Promise<{ success: number; errors: number }> => {
  try {
    const transformedReels = await fetchAndTransformApifyData(apiKey);
    return await saveReelsToSupabase(transformedReels, userInfo);
  } catch (error) {
    console.error("Error importing Apify data:", error);
    throw error;
  }
};

/**
 * Refreshes all existing reels by fetching their URLs from database and getting updated data from Apify
 * @param user - The authenticated user
 * @param apiKey - Optional custom API key. If not provided, uses default key.
 * @param profile - Optional user profile data
 */
export const refreshAllReelsFromApify = async (
  userInfo: { id: string; email: string; fullName: string },
  apiKey?: string
): Promise<{ success: number; errors: number; total: number }> => {
  try {
    // Get all reel URLs from the database - prioritize permalink, then url, then inputurl
    const { data: existingReels, error: fetchError } = await supabase
      .from("reels")
      .select("permalink, url, inputurl")
      .or("permalink.not.is.null,url.not.is.null,inputurl.not.is.null");

    if (fetchError) {
      throw new Error(`Failed to fetch existing reels: ${fetchError.message}`);
    }

    if (!existingReels || existingReels.length === 0) {
      return { success: 0, errors: 0, total: 0 };
    }

    // Extract all unique URLs - prioritize permalink > url > inputurl
    const urls = new Set<string>();
    existingReels.forEach(reel => {
      // Use permalink first, then url, then inputurl
      const urlToUse = reel.permalink || reel.url || reel.inputurl;
      if (urlToUse && urlToUse.trim().length > 0) {
        urls.add(urlToUse.trim());
      }
    });

    const urlArray = Array.from(urls).filter(url => url && url.length > 0);
    
    if (urlArray.length === 0) {
      return { success: 0, errors: 0, total: 0 };
    }

    console.log(`🔄 Refreshing ${urlArray.length} reel(s) from Apify...`);
    console.log(`📋 Sample URLs:`, urlArray.slice(0, 3));

    // Use server-side API to trigger fresh Apify actor runs for all URLs
    const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || 'http://localhost:3001';
    console.log(`🌐 Calling server API: ${API_SERVER_URL}/api/apify/reels`);
    
    const response = await fetch(`${API_SERVER_URL}/api/apify/reels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls: urlArray, apiKey }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Server error:", error);
      throw new Error(error.error || `Server error: ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.items || [];

    console.log(`📦 Received ${items.length} item(s) from Apify`);

    if (items.length === 0) {
      console.warn("⚠️ No reels returned from Apify for the provided URLs");
      return { success: 0, errors: urlArray.length, total: urlArray.length };
    }

    // Transform and save the reels
    console.log(`🔄 Transforming ${items.length} reel(s)...`);
    const transformedReels = items.map(transformApifyToReel);
    
    // Log sample transformed data to verify we're getting fresh data
    if (transformedReels.length > 0) {
      const sample = transformedReels[0];
      console.log(`📊 Sample transformed reel:`, {
        shortcode: sample.shortcode,
        views: sample.videoplaycount,
        likes: sample.likescount,
        comments: sample.commentscount,
        permalink: sample.permalink?.substring(0, 50),
      });
    }
    
    console.log(`💾 Saving ${transformedReels.length} reel(s) to database...`);
    const result = await saveReelsToSupabase(transformedReels, userInfo);
    console.log(`✅ Refresh complete: ${result.success} updated, ${result.errors} errors`);
    
    if (result.errorDetails && result.errorDetails.length > 0) {
      console.warn(`⚠️ Error details:`, result.errorDetails.slice(0, 5));
    }

    return {
      success: result.success,
      errors: result.errors + (urlArray.length - items.length),
      total: urlArray.length
    };
  } catch (error) {
    console.error("Error refreshing reels from Apify:", error);
    throw error;
  }
};
