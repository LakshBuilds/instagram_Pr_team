# Quick Deployment Checklist

## ✅ Pre-Deployment Checklist

- [x] Code updated to use `VITE_API_SERVER_URL` environment variable
- [x] `render.yaml` configured with both services
- [x] `package.json` has `start` script for production
- [x] Server uses `process.env.PORT` (already configured)

## 🚀 Deployment Steps

### Step 1: Commit and Push to GitHub
```bash
git add .
git commit -m "Add proxy server deployment configuration"
git push origin main
```

### Step 2: Deploy via Render Blueprint (Easiest Method)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"Blueprint"**
3. **Connect your GitHub repository**
4. **Render will detect `render.yaml`** and show both services
5. **Review the configuration** and click **"Apply"**

### Step 3: Set Environment Variables

After services are created, set these environment variables:

#### API Service (`instagram-pr-team-api`)
- Go to your API service → **Environment** tab
- Add: `INTERNAL_API_URL` = `https://your-cloudflare-tunnel-url.trycloudflare.com`

#### Frontend Service (`instagram-pr-team`)
- Go to your frontend service → **Environment** tab
- Copy all existing env vars from your current deployment (if any)
- **IMPORTANT**: Add `VITE_API_SERVER_URL` = `https://instagram-pr-team-api.onrender.com`
  - (Use the actual URL Render gives you for the API service)

### Step 4: Verify Deployment

1. **Check API Service**:
   - Visit: `https://instagram-pr-team-api.onrender.com/health`
   - Should return: `{"status":"ok"}`

2. **Check Frontend**:
   - Visit your frontend URL
   - Open browser console (F12)
   - Try the feature that was failing
   - Should work without connection errors!

## 🔧 Troubleshooting

### If API service fails to start:
- Check logs in Render dashboard
- Verify `INTERNAL_API_URL` is set correctly
- Ensure Cloudflare tunnel is running

### If Frontend can't connect:
- Verify `VITE_API_SERVER_URL` matches your API service URL exactly
- Check browser console for errors
- Ensure API service is running (check health endpoint)

### If you see 503 errors:
- Check that `INTERNAL_API_URL` points to a running Cloudflare tunnel
- Verify the tunnel URL is accessible
- Check API service logs for connection errors

## 📝 Notes

- Render free tier: Services may spin down after 15 min inactivity
- First request after spin-down may take 30-60 seconds
- Environment variable changes require redeploy to take effect
- Frontend env vars are baked in at build time - changes need rebuild

