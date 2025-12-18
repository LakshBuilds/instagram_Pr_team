# 🚨 Cloudflare Tunnel Down - Troubleshooting Guide

## Current Error
```
Error: Internal API service unavailable. The Cloudflare tunnel may be down. 
Please check if the tunnel is running.
```

## 🔍 **Root Cause**
Your Cloudflare tunnel `https://strips-ministries-informal-examining.trycloudflare.com` is not responding (503 error).

## 🚀 **Quick Solutions**

### ✅ **Solution 1: Restart Cloudflare Tunnel**

1. **Check if tunnel is running**:
   ```bash
   # Check running processes
   ps aux | grep cloudflared
   
   # Or check specific port
   netstat -tulpn | grep :your-port
   ```

2. **Start/Restart your tunnel**:
   ```bash
   # If using named tunnel
   cloudflared tunnel run your-tunnel-name
   
   # If using quick tunnel (replace with your actual port)
   cloudflared tunnel --url http://localhost:3000
   
   # If using specific port for your scraper
   cloudflared tunnel --url http://localhost:8000
   ```

3. **Update tunnel URL** if it changed:
   - Copy the new tunnel URL from terminal
   - Update your `.env` file:
   ```env
   VITE_INTERNAL_API_URL=https://your-new-tunnel-url.trycloudflare.com
   ```
   - Restart your development server

### ✅ **Solution 2: Switch to External API (Temporary)**

While fixing the tunnel, use Apify API:

1. **In your browser console** (F12):
   ```javascript
   localStorage.setItem('instagram_api_provider', 'external');
   location.reload();
   ```

2. **Or in your app**: Go to Import page and it should show "External API (Apify)" mode

### ✅ **Solution 3: Check Your Internal API Server**

1. **Verify your scraper is running**:
   ```bash
   # Check if your scraper server is running on the expected port
   curl http://localhost:your-port/health
   # or
   curl http://localhost:your-port/scrape?url=test
   ```

2. **Start your scraper server** if it's not running:
   ```bash
   # Navigate to your scraper directory
   cd path/to/your/scraper
   
   # Start the server (adjust command as needed)
   python app.py
   # or
   node server.js
   # or
   npm start
   ```

## 🔧 **Detailed Troubleshooting Steps**

### Step 1: Check Tunnel Status
```bash
# List all tunnels
cloudflared tunnel list

# Check tunnel info
cloudflared tunnel info your-tunnel-name

# Test tunnel connectivity
curl https://strips-ministries-informal-examining.trycloudflare.com/health
```

### Step 2: Restart Everything
```bash
# Kill existing cloudflared processes
pkill cloudflared

# Start your internal API server first
cd /path/to/your/scraper
python app.py  # or whatever command starts your server

# In another terminal, start tunnel
cloudflared tunnel --url http://localhost:your-port
```

### Step 3: Update Configuration
If you get a new tunnel URL, update these files:

1. **`.env` file**:
   ```env
   VITE_INTERNAL_API_URL=https://your-new-tunnel-url.trycloudflare.com
   ```

2. **Restart dev server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## 🚨 **Common Issues & Fixes**

### Issue: "Tunnel URL keeps changing"
**Fix**: Use a named tunnel instead of quick tunnel:
```bash
# Create named tunnel (one time)
cloudflared tunnel create my-scraper-tunnel

# Use named tunnel (stable URL)
cloudflared tunnel run my-scraper-tunnel
```

### Issue: "Port already in use"
**Fix**: Find and kill the process:
```bash
# Find process using port
lsof -i :your-port

# Kill the process
kill -9 PID
```

### Issue: "Internal server not responding"
**Fix**: Check your scraper server logs and restart it:
```bash
# Check if server is running
ps aux | grep python  # or node, depending on your server

# Restart your scraper server
cd /path/to/scraper
python app.py
```

## 📊 **Verification Steps**

After fixing, verify everything works:

1. **Test tunnel directly**:
   ```bash
   curl https://your-tunnel-url.trycloudflare.com/health
   ```

2. **Test through your app**:
   - Go to Import Reels page
   - Should show "Internal API" mode
   - Try importing a single reel

3. **Check console logs**:
   - Open browser DevTools (F12)
   - Look for successful API calls
   - No more 503 errors

## 🔄 **Prevention Tips**

1. **Use named tunnels** for stability
2. **Set up tunnel auto-restart** with systemd or pm2
3. **Monitor tunnel health** with a simple script
4. **Keep backup External API** ready for fallback

## 📞 **Still Having Issues?**

If the tunnel is still not working:

1. **Check Cloudflare status**: https://www.cloudflarestatus.com/
2. **Try different tunnel**: Create a new tunnel with a different name
3. **Use External API**: Switch to Apify temporarily
4. **Check firewall**: Ensure ports are not blocked

## ✅ **Success Indicators**

You'll know it's fixed when:
- ✅ Tunnel URL responds to curl/browser requests
- ✅ Import page shows "Internal API" mode
- ✅ Single reel import completes in 2-5 seconds
- ✅ No more 503 errors in console

The tunnel issue is usually quick to fix once you restart the cloudflared process! 🚀