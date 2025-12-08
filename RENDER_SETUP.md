# Render Deployment Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              RENDER.COM                                  │
│                                                                         │
│  ┌─────────────────────────┐     ┌─────────────────────────────────┐   │
│  │  instagram-pr-team      │     │  instagram-pr-team-api          │   │
│  │  (Static Frontend)      │────▶│  (Node.js API Server)           │   │
│  │                         │     │                                 │   │
│  │  VITE_API_SERVER_URL ───┼──┐  │  INTERNAL_API_URL ──────────────┼───┤
│  └─────────────────────────┘  │  └─────────────────────────────────┘   │
│                               │                                         │
│                               │                                         │
│                               ▼                                         │
│        Points to ─────────────┘                                         │
│   instagram-pr-team-api.onrender.com                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
                                         ┌─────────────────────────────────┐
                                         │  Cloudflare Tunnel              │
                                         │  rosa-pacific-regarding-        │
                                         │  caring.trycloudflare.com       │
                                         │                                 │
                                         │  (Your local internal API)      │
                                         └─────────────────────────────────┘
```

## Step-by-Step Setup

### 1️⃣ Deploy API Service (instagram-pr-team-api)

In Render Dashboard, create/configure the API service with these settings:

**Build Command:** `npm install`
**Start Command:** `npm start`

**Environment Variables:**
| Variable | Value |
|----------|-------|
| `INTERNAL_API_URL` | `https://rosa-pacific-regarding-caring.trycloudflare.com` |
| `PORT` | `10000` |
| `NODE_ENV` | `production` |

### 2️⃣ Get the API Service URL

After deploying, copy the URL from Render (something like):
```
https://instagram-pr-team-api.onrender.com
```

### 3️⃣ Configure Frontend Service (instagram-pr-team)

**Build Command:** `npm install && npm run build`
**Publish Directory:** `./dist`

**Environment Variables:**
| Variable | Value |
|----------|-------|
| `VITE_API_SERVER_URL` | `https://instagram-pr-team-api.onrender.com` |
| `VITE_SUPABASE_URL` | Your Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk key |
| `VITE_APIFY_TOKEN` | Your Apify token |

### 4️⃣ Redeploy Frontend

After setting `VITE_API_SERVER_URL`, trigger a redeploy of the frontend service.

## ⚠️ Important Notes

1. **Cloudflare Tunnel:** The URL `https://rosa-pacific-regarding-caring.trycloudflare.com` is a temporary tunnel. If it expires, you'll need to:
   - Start a new Cloudflare tunnel locally
   - Update `INTERNAL_API_URL` in Render with the new tunnel URL

2. **Order matters:** Deploy the API service first, then configure the frontend with the API URL.

3. **Free tier:** Render free tier services may sleep after inactivity. The first request may be slow.

## Testing

1. Visit your API health endpoint: `https://instagram-pr-team-api.onrender.com/health`
   - Should return: `{"status":"ok"}`

2. If health check works but scraping fails, check if your Cloudflare tunnel is still running.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `ERR_CONNECTION_REFUSED` | API service not running. Check Render logs. |
| `503 Service Unavailable` | Cloudflare tunnel is down. Restart tunnel locally. |
| `INTERNAL_API_URL is required` | Set the env var in Render API service. |

