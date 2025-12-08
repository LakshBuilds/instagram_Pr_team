# Script to fix Cloudflare tunnel URL
Write-Host "🔍 Checking Cloudflare tunnel status..."

# Stop existing cloudflared processes
Write-Host "🛑 Stopping existing cloudflared processes..."
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

# Note: You'll need to manually start cloudflared and get the new URL
Write-Host ""
Write-Host "📝 Next steps:"
Write-Host "1. Start your Cloudflare tunnel:"
Write-Host "   cloudflared tunnel --url http://localhost:YOUR_INTERNAL_API_PORT"
Write-Host ""
Write-Host "2. Copy the new tunnel URL (looks like https://xxx.trycloudflare.com)"
Write-Host ""
Write-Host "3. Update .env file with:"
Write-Host "   INTERNAL_API_URL=https://your-new-tunnel-url.trycloudflare.com"
Write-Host ""
Write-Host "4. Restart your proxy server"

