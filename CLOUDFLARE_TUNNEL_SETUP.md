# Cloudflare Tunnel Setup Guide

## The Problem

You're getting a **503 Service Unavailable** error because:
- ✅ Your proxy server IS running (localhost:3001)
- ❌ Your Cloudflare tunnel is DOWN or not accessible

## What is a Cloudflare Tunnel?

A Cloudflare tunnel exposes your local/internal API service to the internet securely. Your proxy server forwards requests to this tunnel URL.

## Quick Fix Options

### Option 1: Start Your Cloudflare Tunnel (If you have one)

If you have a Cloudflare tunnel running locally, you need to start it:

```bash
# If using cloudflared CLI
cloudflared tunnel run

# Or if you have a specific tunnel name
cloudflared tunnel run <tunnel-name>
```

**Then update your `.env` file:**
```env
INTERNAL_API_URL=https://your-tunnel-url.trycloudflare.com
```

### Option 2: Use Apify Instead (Temporary Workaround)

If you don't have a Cloudflare tunnel set up, you can use the Apify endpoints instead:

The proxy server also has Apify endpoints that don't require the Cloudflare tunnel:
- `POST /api/apify/reel` - Single reel
- `POST /api/apify/reels` - Multiple reels

**To use Apify:**
1. Make sure you have `VITE_APIFY_TOKEN` set in your `.env` or environment variables
2. Use the Apify endpoints instead of the internal API endpoints

### Option 3: Set Up a New Cloudflare Tunnel

If you need to set up a new Cloudflare tunnel:

1. **Install cloudflared:**
   ```bash
   # Windows (using Chocolatey)
   choco install cloudflared
   
   # Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Start a tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:YOUR_INTERNAL_API_PORT
   ```
   Replace `YOUR_INTERNAL_API_PORT` with the port your internal API runs on.

3. **Copy the tunnel URL** (looks like `https://xxx.trycloudflare.com`)

4. **Update `.env`:**
   ```env
   INTERNAL_API_URL=https://xxx.trycloudflare.com
   ```

5. **Restart your proxy server**

## Check Your Current Setup

Run this to see what INTERNAL_API_URL is configured:

```bash
# Windows PowerShell
Get-Content .env | Select-String "INTERNAL_API_URL"

# Or check server logs when it starts
npm run dev:server
```

Look for this line in the server output:
```
✅ Internal API URL loaded from .env: https://...
```

## Testing the Tunnel

Once your tunnel is running, test it:

```bash
# Test the tunnel directly
curl https://your-tunnel-url.trycloudflare.com/scrape?url=https://www.instagram.com/reel/ABC123/

# Test through your proxy
curl -X POST http://localhost:3001/api/internal/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/ABC123/"}'
```

## Common Issues

### Issue: Tunnel URL keeps changing
**Solution:** Use a named tunnel instead of quick tunnels:
```bash
cloudflared tunnel create my-tunnel
cloudflared tunnel route dns my-tunnel api.yourdomain.com
cloudflared tunnel run my-tunnel
```

### Issue: Tunnel works but proxy still returns 503
**Solution:** 
- Check that `.env` has the correct URL
- Restart the proxy server after updating `.env`
- Verify the tunnel URL is accessible from your machine

### Issue: Don't have/want a Cloudflare tunnel
**Solution:** Use the Apify endpoints (`/api/apify/reel` or `/api/apify/reels`) which don't require a tunnel.

