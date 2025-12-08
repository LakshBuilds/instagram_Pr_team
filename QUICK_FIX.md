# Quick Fix for 503 Error

## Problem
Your Cloudflare tunnel URL has expired. The URL in `.env` (`https://telecom-back-determines-diving.trycloudflare.com`) is no longer valid.

## Solution: Restart Tunnel and Update URL

### Step 1: Get New Tunnel URL

**Option A: If you have cloudflared installed locally**
```bash
# Stop old tunnel
taskkill /F /IM cloudflared.exe

# Start new tunnel (replace PORT with your internal API port)
cloudflared tunnel --url http://localhost:PORT

# Copy the new URL that appears (looks like https://xxx.trycloudflare.com)
```

**Option B: Check cloudflared output**
If cloudflared is already running, check the terminal/console where you started it - it should show the current tunnel URL.

### Step 2: Update .env File

Open `.env` and update:
```env
INTERNAL_API_URL=https://your-new-tunnel-url.trycloudflare.com
```

### Step 3: Restart Proxy Server

The proxy server needs to reload the new URL. If you're running `npm run dev:all`, restart it:
```bash
# Stop current process (Ctrl+C)
# Then restart:
npm run dev:all
```

## Alternative: Use Apify Instead (No Tunnel Needed)

If you don't want to deal with Cloudflare tunnels, you can use Apify endpoints instead:

1. Make sure you have `VITE_APIFY_TOKEN` in your `.env`
2. The proxy server already has Apify endpoints:
   - `/api/apify/reel` - Single reel
   - `/api/apify/reels` - Multiple reels

These don't require a Cloudflare tunnel!

## Test After Fix

```bash
# Test tunnel directly
curl https://your-new-tunnel-url.trycloudflare.com/scrape?url=https://www.instagram.com/reel/test/

# Test through proxy
curl -X POST http://localhost:3001/api/internal/scrape -H "Content-Type: application/json" -d '{"url": "https://www.instagram.com/reel/test/"}'
```

