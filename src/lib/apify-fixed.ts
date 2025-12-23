// Fixed version of apify.ts with proper error handling and connection management
import { supabase } from "@/integrations/supabase/client";

// ... (keep all the existing interfaces and types - ApifyInstagramPost, TransformedReel, etc.)

/**
 * Enhanced saveReelsToSupabase with proper error handling and connection management
 */
export const saveReelsToSupabase = async (
  reels: TransformedReel[],
  userInfo: { id: string; email: string; fullName: string }
): Promise<{ success: number; errors: number; errorDetails?: string[] }> => {
  let success = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // Process reels in smaller batches to avoid connection issues
  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < reels.length; i += BATCH_SIZE) {
    batches.push(reels.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${reels.length} reels in ${batches.length} batches of ${BATCH_SIZE}`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} reels)`);

    // Add delay between batches to prevent overwhelming the connection
    if (batchIndex > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const reel of batch) {
      try {
        const result = await processReelWithRetry(reel, userInfo);
        if (result.success) {
          success++;
        } else {
          errors++;
          if (result.error) {
            errorDetails.push(result.error);
          }
        }
      } catch (error: any) {
        const errorMsg = `Unexpected error processing reel: ${error?.message || error}`;
        console.error(errorMsg, error);
        errors++;
        errorDetails.push(errorMsg);
      }
    }
  }

  return { success, errors, errorDetails: errorDetails.length > 0 ? errorDetails : undefined };
};

/**
 * Process a single reel with retry logic and proper error handling
 */
async function processReelWithRetry(
  reel: TransformedReel,
  userInfo: { id: string; email: string; fullName: string },
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processSingleReel(reel, userInfo);
    } catch (error: any) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for reel:`, error?.message);
      
      // Check if it's a connection error that we should retry
      const isRetryableError = 
        error?.message?.includes('callback is no longer runnable') ||
        error?.message?.includes('connection') ||
        error?.message?.includes('timeout') ||
        error?.code === 'PGRST301' ||
        error?.code === 'PGRST116';

      if (attempt === maxRetries || !isRetryableError) {
        return {
          success: false,
          error: `Failed after ${maxRetries} attempts: ${error?.message || error}`
        };
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Process a single reel with optimized database queries
 */
async function processSingleReel(
  reel: TransformedReel,
  userInfo: { id: string; email: string; fullName: string }
): Promise<{ success: boolean; error?: string }> {
  // Validate reel has required fields
  const identifier = reel.permalink || reel.url || reel.shortcode;
  if (!identifier) {
    return {
      success: false,
      error: "Skipping reel without identifier"
    };
  }

  try {
    // Use a single optimized query to find existing reel
    const existing = await findExistingReel(reel);

    if (existing) {
      // Update existing reel
      const updateData = {
        ...reel,
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
        .eq("id", existing.id);

      if (error) {
        throw error;
      }

      console.log(`✅ Updated reel: ${identifier}`);
      if (reel.is_archived) {
        console.log(`Marked reel as archived: ${identifier}`);
      }
    } else {
      // Insert new reel
      const { error } = await supabase.from("reels").insert({
        ...reel,
        created_by_user_id: userInfo.id,
        created_by_email: userInfo.email,
        created_by_name: userInfo.fullName,
      });

      if (error) {
        throw error;
      }

      console.log(`✅ Inserted new reel: ${identifier}`);
      if (reel.is_archived) {
        console.log(`Inserted archived reel: ${identifier}`);
      }
    }

    return { success: true };
  } catch (error: any) {
    const errorMsg = `Error processing reel ${identifier}: ${error.message}`;
    console.error(errorMsg, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Optimized function to find existing reel with a single query
 */
async function findExistingReel(reel: TransformedReel): Promise<{ id: string } | null> {
  try {
    // Build conditions for the OR query
    const conditions = [];
    
    if (reel.permalink) conditions.push(`permalink.eq.${reel.permalink}`);
    if (reel.url) conditions.push(`url.eq.${reel.url}`);
    if (reel.inputurl) conditions.push(`inputurl.eq.${reel.inputurl}`);
    if (reel.shortcode) conditions.push(`shortcode.eq.${reel.shortcode}`);

    if (conditions.length === 0) {
      return null;
    }

    // Use a single query with OR conditions
    const { data, error } = await supabase
      .from("reels")
      .select("id, permalink, url, inputurl, shortcode, videoplaycount, likescount, commentscount")
      .or(conditions.join(','))
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error finding existing reel:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in findExistingReel:', error);
    return null;
  }
}

/**
 * Enhanced connection health check
 */
async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("reels")
      .select("id")
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return false;
  }
}

/**
 * Wrapper function to ensure connection is healthy before operations
 */
export const saveReelsToSupabaseWithHealthCheck = async (
  reels: TransformedReel[],
  userInfo: { id: string; email: string; fullName: string }
): Promise<{ success: number; errors: number; errorDetails?: string[] }> => {
  // Check connection health first
  const isHealthy = await checkSupabaseConnection();
  if (!isHealthy) {
    console.error('Supabase connection is not healthy, aborting operation');
    return {
      success: 0,
      errors: reels.length,
      errorDetails: ['Database connection is not healthy']
    };
  }

  return saveReelsToSupabase(reels, userInfo);
};

// Export the enhanced version as the default
export { saveReelsToSupabaseWithHealthCheck as saveReelsToSupabase };