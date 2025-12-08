# Deployment Guide for Render

This guide explains how to deploy both the frontend and proxy server to Render.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │ ──────> │  Proxy Server    │ ──────> │  Internal API   │
│  (Static Site)  │         │  (Node.js API)    │         │  (Cloudflare)   │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Environment Variables**: You'll need:
   - `INTERNAL_API_URL` - Your Cloudflare tunnel URL (e.g., `https://your-tunnel.trycloudflare.com`)
   - `VITE_API_SERVER_URL` - Will be set after API service deployment

## Deployment Steps

### Step 1: Deploy the Proxy Server (API)

1. **Go to Render Dashboard** → Click "New +" → "Web Service"
2. **Connect your repository**
3. **Configure the service:**
   - **Name**: `instagram-pr-team-api` (or your preferred name)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `INTERNAL_API_URL` = `https://your-cloudflare-tunnel-url.trycloudflare.com`
     - `NODE_ENV` = `production`
     - `PORT` = `10000` (Render will override this, but good to have)

4. **Click "Create Web Service"**
5. **Wait for deployment** - Note the service URL (e.g., `https://instagram-pr-team-api.onrender.com`)

### Step 2: Deploy the Frontend

1. **Go to Render Dashboard** → Click "New +" → "Static Site"
2. **Connect your repository**
3. **Configure the service:**
   - **Name**: `instagram-pr-team` (or your preferred name)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_CLERK_PUBLISHABLE_KEY` = Your Clerk publishable key
     - `VITE_SUPABASE_URL` = Your Supabase URL
     - `VITE_SUPABASE_PUBLISHABLE_KEY` = Your Supabase anon key
     - `VITE_INTERNAL_API_URL` = (if needed)
     - `VITE_APIFY_TOKEN` = (if needed)
     - **`VITE_API_SERVER_URL`** = `https://instagram-pr-team-api.onrender.com` (use the URL from Step 1)

4. **Click "Create Static Site"**

### Step 3: Update Environment Variables (After First Deployment)

After both services are deployed:

1. **Update Frontend Environment Variable**:
   - Go to your frontend service settings
   - Update `VITE_API_SERVER_URL` to match your API service URL
   - Trigger a new deployment (Render will rebuild with the new env var)

## Using render.yaml (Alternative Method)

If you prefer using `render.yaml`:

1. **Push your code** with the updated `render.yaml` to GitHub
2. **Go to Render Dashboard** → "New +" → "Blueprint"
3. **Connect your repository**
4. **Render will detect `render.yaml`** and create both services automatically
5. **Set environment variables** in the Render dashboard for both services:
   - API Service: `INTERNAL_API_URL`
   - Frontend Service: `VITE_API_SERVER_URL` (set to your API service URL after it's deployed)

## Environment Variables Reference

### Proxy Server (API Service)
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `INTERNAL_API_URL` | ✅ Yes | Cloudflare tunnel URL | `https://abc123.trycloudflare.com` |
| `PORT` | ❌ No | Server port (Render sets this) | `10000` |
| `NODE_ENV` | ❌ No | Environment | `production` |

### Frontend (Static Site)
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ Yes | Clerk authentication key | `pk_live_...` |
| `VITE_SUPABASE_URL` | ✅ Yes | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | Supabase anon key | `eyJhbGc...` |
| `VITE_API_SERVER_URL` | ✅ Yes | API service URL | `https://instagram-pr-team-api.onrender.com` |
| `VITE_INTERNAL_API_URL` | ❌ No | (If needed) | - |
| `VITE_APIFY_TOKEN` | ❌ No | (If needed) | - |

## Troubleshooting

### Issue: Frontend can't connect to API
**Solution**: 
- Verify `VITE_API_SERVER_URL` is set correctly in frontend environment variables
- Check that the API service is running (check logs in Render dashboard)
- Ensure the API service URL is accessible (try opening it in a browser)

### Issue: API returns 503 - Service Unavailable
**Solution**:
- Check that `INTERNAL_API_URL` is set correctly in API service environment variables
- Verify your Cloudflare tunnel is running and accessible
- Check API service logs in Render dashboard for connection errors

### Issue: CORS errors
**Solution**:
- The proxy server already handles CORS, but verify it's running
- Check that `VITE_API_SERVER_URL` points to the correct API service URL

## Testing After Deployment

1. **Test API Health Endpoint**:
   ```bash
   curl https://instagram-pr-team-api.onrender.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Test Frontend**:
   - Open your frontend URL in a browser
   - Open browser console (F12)
   - Try the feature that uses the API
   - Check for any errors in console

## Notes

- **Render Free Tier**: Services spin down after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.
- **Auto-Deploy**: Render automatically deploys when you push to your main branch (if enabled)
- **Environment Variables**: Changes to environment variables require a redeploy to take effect
- **Build Time**: Frontend builds include environment variables at build time, so changes require a rebuild

