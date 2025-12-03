// Server-side API route for Apify calls
// This avoids CORS, bot detection, and Instagram blocking

const APIFY_ACTOR_ID = "shu8hvrXbJbY3Eb9W";
const DEFAULT_APIFY_TOKEN = process.env.APIFY_TOKEN || "";

/**
 * Normalizes Instagram URL
 */
function normalizeInstagramUrl(url) {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    const urlObj = new URL(normalized);
    urlObj.search = '';
    urlObj.hash = '';
    normalized = urlObj.toString().replace(/\/+$/, '');
    return normalized;
  } catch (e) {
    return url.trim().replace(/\?.*$/, '').replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Triggers Apify actor run and waits for completion
 */
async function triggerApifyActorRun(url, apiKey) {
  const token = apiKey || DEFAULT_APIFY_TOKEN;
  const normalizedUrl = normalizeInstagramUrl(url);

  console.log("Triggering actor run for:", normalizedUrl);

  const actorInput = {
    directUrls: [normalizedUrl],
    resultsType: "posts",
    resultsLimit: 10,
    addParentData: false,
    enhanceUserSearchWithFacebookPage: false,
    isUserReelFeedURL: false,
    isUserTaggedFeedURL: false,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"]
    }
  };

  const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(actorInput),
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
  const maxAttempts = 120; // Wait up to 10 minutes (120 * 5 seconds)

  console.log(`Polling for run completion. Initial status: ${status}`);
  while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    status = statusData.data.status;
    attempts++;
    
    if (attempts % 10 === 0) {
      console.log(`Still polling... Status: ${status}, Attempt: ${attempts}/${maxAttempts}`);
    }
  }
  
  console.log(`Run completed with status: ${status} after ${attempts} attempts`);

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify actor run ${status.toLowerCase()}. Run ID: ${runId}`);
  }

  console.log(`Actor run succeeded. Run ID: ${runId}, Dataset ID: ${defaultDatasetId}`);
  return { runId, defaultDatasetId };
}

/**
 * Fetches dataset items
 */
async function fetchApifyDatasetItems(datasetId, apiKey) {
  const token = apiKey || DEFAULT_APIFY_TOKEN;
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`;
  
  console.log("Fetching dataset items from:", url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch dataset:", errorText);
    throw new Error(`Failed to fetch dataset items: ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  const items = Array.isArray(data) ? data : [data];
  
  console.log(`Dataset returned ${items.length} item(s)`);
  if (items.length > 0) {
    console.log("First item keys:", Object.keys(items[0]));
    if (items[0].error) {
      console.log("Error in first item:", items[0].error, items[0].errorDescription);
    }
  }
  
  return items;
}

/**
 * Main handler for fetching reel from Apify
 */
export async function fetchReelFromApify(url, apiKey) {
  try {
    console.log("=== Starting fetchReelFromApify ===");
    console.log("Input URL:", url);
    
    // Trigger actor run and wait for completion
    const { defaultDatasetId, runId } = await triggerApifyActorRun(url, apiKey);
    console.log("Got dataset ID:", defaultDatasetId);
    console.log("Got run ID:", runId);
    
    // Wait longer for dataset to be ready and retry if needed
    // Sometimes the dataset needs more time to populate even after run succeeds
    let items = [];
    let attempts = 0;
    const maxAttempts = 10; // Try up to 10 times
    
    while (attempts < maxAttempts) {
      const waitTime = attempts === 0 ? 10000 : 15000; // 10s first, then 15s
      console.log(`Waiting ${waitTime/1000}s for dataset to populate (attempt ${attempts + 1}/${maxAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Fetch dataset items
      items = await fetchApifyDatasetItems(defaultDatasetId, apiKey);
      console.log(`Fetched ${items.length} items on attempt ${attempts + 1}`);
      
      // Check if we have valid data (not just errors)
      const validItems = items.filter(item => !item.error && !item.errorDescription && item.id);
      if (validItems.length > 0) {
        console.log(`✅ Found ${validItems.length} valid items!`);
        return validItems;
      }
      
      // If we only have error items, check if we should retry
      const errorItems = items.filter(item => item.error || item.errorDescription);
      if (errorItems.length > 0) {
        console.log(`⚠️ Got error items: ${errorItems[0]?.errorDescription || errorItems[0]?.error}`);
        // Still retry - sometimes the dataset populates later
        if (attempts < maxAttempts - 1) {
          console.log("Retrying...");
          attempts++;
          continue;
        }
      } else if (items.length === 0) {
        // Empty dataset - might still be populating
        console.log("Dataset is empty, waiting longer...");
        if (attempts < maxAttempts - 1) {
          attempts++;
          continue;
        }
      }
      
      attempts++;
    }
    
    console.log(`❌ After ${maxAttempts} attempts, still no valid data. Returning what we have.`);
    
    console.log("=== fetchReelFromApify Complete ===");
    return items; // Return whatever we got (may be errors)
  } catch (error) {
    console.error("Error fetching reel from Apify:", error);
    throw error;
  }
}

/**
 * Main handler for fetching multiple reels from Apify
 */
export async function fetchReelsFromApify(urls, apiKey) {
  try {
    const token = apiKey || DEFAULT_APIFY_TOKEN;
    // Remove duplicates by using Set
    const normalizedUrls = [...new Set(urls.map(url => normalizeInstagramUrl(url)))];

    console.log("Triggering bulk actor run for:", normalizedUrls.length, "URLs (after deduplication)");

    const actorInput = {
      directUrls: normalizedUrls,
      resultsType: "posts",
      resultsLimit: Math.max(normalizedUrls.length, 10),
      addParentData: false,
      enhanceUserSearchWithFacebookPage: false,
      isUserReelFeedURL: false,
      isUserTaggedFeedURL: false,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };

    const runResponse = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actorInput),
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
    const maxAttempts = 120; // Wait up to 10 minutes for bulk

    while (status !== "SUCCEEDED" && status !== "FAILED" && status !== "ABORTED" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
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

    // Wait for dataset to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Fetch dataset items
    const items = await fetchApifyDatasetItems(defaultDatasetId, apiKey);
    
    return items;
  } catch (error) {
    console.error("Error fetching reels from Apify:", error);
    throw error;
  }
}

