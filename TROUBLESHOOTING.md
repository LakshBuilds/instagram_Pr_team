# Troubleshooting Guide

## Error: `ERR_CONNECTION_REFUSED` - Proxy Server Not Running

### Understanding the Error

The error you're seeing:
```
Failed to load resource: net::ERR_CONNECTION_REFUSED
❌ Error in fetchFromInternalApiDirect: TypeError: Failed to fetch
❌ Proxy server not running at localhost:3001
```

**What's happening:**
1. Your frontend application (running in the browser) is trying to make API calls to a proxy server at `http://localhost:3001`
2. The proxy server is **not running**, so the connection is refused
3. The frontend code in `src/lib/internalApi.ts` calls `fetch('http://localhost:3001/api/internal/scrape')` which fails because nothing is listening on port 3001

### Why Do You Need a Proxy Server?

The proxy server (`server/index.js`) is needed because:
- It avoids CORS (Cross-Origin Resource Sharing) issues
- It securely handles API keys server-side (not exposed to the browser)
- It proxies requests to your internal API (Cloudflare tunnel)

### How to Fix It

#### Option 1: Run Both Frontend and Server Together (Recommended)
```bash
npm run dev:all
```
This starts both:
- Frontend (Vite dev server) on `http://localhost:5173` (or similar)
- Proxy server on `http://localhost:3001`

#### Option 2: Run Server Separately
In one terminal:
```bash
npm run dev:server
```

In another terminal:
```bash
npm run dev
```

### Required Environment Variables

The proxy server requires a `.env` file in the project root with:

```env
INTERNAL_API_URL=https://your-cloudflare-url.trycloudflare.com
```

**If `INTERNAL_API_URL` is missing**, the server will exit with:
```
❌ ERROR: INTERNAL_API_URL is required in .env file!
```

### Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │ ──────> │ Proxy Server │ ──────> │ Internal API │
│  (Frontend) │         │ (localhost:  │         │ (Cloudflare) │
│             │         │    3001)     │         │              │
└─────────────┘         └──────────────┘         └─────────────┘
```

1. **Browser** makes request to `localhost:3001/api/internal/scrape`
2. **Proxy Server** receives request and forwards it to `INTERNAL_API_URL/scrape`
3. **Internal API** processes the request and returns data
4. **Proxy Server** returns data to browser

### Verification Steps

1. **Check if server is running:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok"}`

2. **Check server logs:**
   When the server starts, you should see:
   ```
   ✅ Internal API URL loaded from .env: https://your-url...
   🚀 Apify API server running on http://localhost:3001
   ```

3. **Check browser console:**
   - If server is running: You'll see successful API calls
   - If server is NOT running: You'll see `ERR_CONNECTION_REFUSED`

### Common Issues

#### Issue: Server starts but exits immediately
**Cause:** Missing `INTERNAL_API_URL` in `.env` file
**Solution:** Create `.env` file with `INTERNAL_API_URL=your-url`

#### Issue: Port 3001 already in use
**Cause:** Another process is using port 3001
**Solution:** 
- Kill the process using port 3001, or
- Change the port in `server/index.js`: `const PORT = process.env.PORT || 3002;`
- Update `src/lib/internalApi.ts`: `const proxyUrl = 'http://localhost:3002/api/internal/scrape';`

#### Issue: CORS errors even with server running
**Cause:** Server CORS configuration issue
**Solution:** Check that `server/index.js` has proper CORS setup (it should allow all origins in dev)

### Quick Start Checklist

- [ ] Create `.env` file with `INTERNAL_API_URL`
- [ ] Run `npm install` to ensure all dependencies are installed
- [ ] Run `npm run dev:all` to start both frontend and server
- [ ] Verify server is running: `curl http://localhost:3001/health`
- [ ] Check browser console for successful API calls

