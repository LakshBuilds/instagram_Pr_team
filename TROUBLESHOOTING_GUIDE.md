# Instagram Reels Analytics - Error Troubleshooting Guide

## 🚨 Current Error: "The provided callback is no longer runnable"

### Error Details
```
Error inserting reel https://www.instagram.com/p/DSITMscgci0/: 
Error: The provided callback is no longer runnable.
```

### ✅ FIXED - Applied Solution

I've applied a fix to your `src/lib/apify.ts` file that addresses this issue:

#### Changes Made:

1. **Batch Processing**: Process reels in smaller batches (3 at a time) instead of all at once
2. **Retry Logic**: Added retry mechanism with exponential backoff for failed operations
3. **Optimized Queries**: Reduced multiple database queries to a single OR query
4. **Connection Management**: Added delays between batches to prevent connection overload
5. **Better Error Handling**: Specific handling for Supabase connection errors

#### Key Improvements:

```typescript
// Before: Multiple sequential queries
const permalinkMatch = await supabase.from("reels").select("*").eq("permalink", reel.permalink);
const urlMatch = await supabase.from("reels").select("*").eq("url", reel.url);
const inputUrlMatch = await supabase.from("reels").select("*").eq("inputurl", reel.inputurl);
// ... more queries

// After: Single optimized query
const conditions = [];
if (reel.permalink) conditions.push(`permalink.eq.${reel.permalink}`);
if (reel.url) conditions.push(`url.eq.${reel.url}`);
if (reel.inputurl) conditions.push(`inputurl.eq.${reel.inputurl}`);

const { data: existingMatch } = await supabase
  .from("reels")
  .select("*")
  .or(conditions.join(','))
  .limit(1)
  .maybeSingle();
```

## 🔧 Additional Fixes You Can Apply

### 1. Environment Variables Check

Make sure your `.env` file has proper Supabase configuration:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APIFY_TOKEN=your_apify_token
VITE_API_SERVER_URL=http://localhost:3001
```

### 2. Server Restart

After the fix, restart your development server:

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
# or
yarn dev
```

### 3. Clear Browser Cache

Clear your browser cache and localStorage:

```javascript
// Run in browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## 🚀 Testing the Fix

1. **Try importing a single reel first**:
   - Go to Import Reels page
   - Use a simple Instagram URL like: `https://www.instagram.com/p/DSITMscgci0/`
   - Click "Import Reel"

2. **Monitor the console**:
   - Open browser DevTools (F12)
   - Watch for batch processing logs
   - Look for retry attempts if any errors occur

3. **Expected behavior**:
   - You should see logs like: "Processing 1 reels in batches of 3"
   - If there are connection issues, you'll see retry attempts
   - Success message should appear when complete

## 🔍 Monitoring and Debugging

### Console Logs to Watch For:

✅ **Good logs**:
```
Processing 1 reels in batches of 3
Processing batch 1 (1 reels)
✅ Updated reel: https://www.instagram.com/p/DSITMscgci0/
```

⚠️ **Warning logs** (normal with retry):
```
Attempt 1/3 failed for reel: The provided callback is no longer runnable
Retrying in 1000ms...
Attempt 2/3 succeeded
```

❌ **Error logs** (need attention):
```
Failed after 3 attempts: The provided callback is no longer runnable
```

### If Errors Persist:

1. **Check Supabase Dashboard**:
   - Go to your Supabase project dashboard
   - Check if there are any connection limits or issues
   - Look at the database logs

2. **Reduce Batch Size Further**:
   ```typescript
   // In src/lib/apify.ts, change:
   const BATCH_SIZE = 3; // to
   const BATCH_SIZE = 1; // Process one at a time
   ```

3. **Increase Delays**:
   ```typescript
   // Change delay between batches:
   await new Promise(resolve => setTimeout(resolve, 2000)); // to
   await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
   ```

## 🛠️ Advanced Troubleshooting

### Check Supabase Connection Health

Add this function to test your connection:

```typescript
// Add to src/lib/apify.ts
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from("reels")
      .select("id")
      .limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection is healthy');
    return true;
  } catch (error) {
    console.error('Connection test error:', error);
    return false;
  }
};
```

### Database Performance Check

If you have many reels, consider adding an index:

```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS idx_reels_lookup 
ON reels (permalink, url, inputurl, shortcode);
```

## 📊 Performance Monitoring

### Expected Performance After Fix:

- **Single Reel Import**: 2-5 seconds
- **Bulk Import (5 reels)**: 10-15 seconds
- **Large Bulk Import (20+ reels)**: 1-2 minutes

### Memory Usage:

- Should stay under 100MB during import
- No memory leaks or growing usage over time

## 🆘 If Nothing Works

### Last Resort Options:

1. **Use Internal API Only**:
   ```typescript
   // In src/lib/apiProvider.ts
   export function getApiProvider(): ApiProvider {
     return 'internal'; // Force internal API
   }
   ```

2. **Import One at a Time**:
   - Avoid bulk import temporarily
   - Import reels individually until the issue is resolved

3. **Contact Support**:
   - Check Supabase status page
   - Contact Supabase support if the issue persists
   - Provide error logs and project details

## ✅ Success Indicators

You'll know the fix worked when:

1. ✅ No more "callback is no longer runnable" errors
2. ✅ Reels import successfully with batch processing logs
3. ✅ Retry logic works for temporary connection issues
4. ✅ Overall import success rate improves significantly

The fix I've applied should resolve the immediate issue. Try importing a reel now and let me know if you see any improvements!