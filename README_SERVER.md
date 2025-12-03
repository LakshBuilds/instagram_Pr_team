# Server-Side Apify API Setup

## Why Server-Side?

Calling Apify directly from the browser causes:
- ❌ CORS errors
- ❌ Bot detection by Instagram
- ❌ Missing headers/user-agent
- ❌ Rate limiting issues

**Solution:** Use a server-side API that calls Apify (just like the Apify API Tester).

## Setup Instructions

### 1. Install Dependencies

```bash
npm install express cors concurrently
```

### 2. Start the Server

**Option A: Run server separately**
```bash
npm run dev:server
```

**Option B: Run both frontend and server together**
```bash
npm run dev:all
```

The server will run on `http://localhost:3001`

### 3. Update Environment Variables (Optional)

If your server runs on a different port, add to `.env`:
```
VITE_API_SERVER_URL=http://localhost:3001
```

## How It Works

1. **Frontend** calls `/api/apify/reel` (your Express server)
2. **Express server** calls Apify API (server-side, no CORS)
3. **Apify** scrapes Instagram (with proper headers/proxies)
4. **Server** returns data to frontend

## API Endpoints

### Single Reel
```
POST /api/apify/reel
Body: { url: string, apiKey?: string }
```

### Bulk Reels
```
POST /api/apify/reels
Body: { urls: string[], apiKey?: string }
```

## Production Deployment

For production, deploy the Express server separately and update `VITE_API_SERVER_URL` to point to your production server URL.



