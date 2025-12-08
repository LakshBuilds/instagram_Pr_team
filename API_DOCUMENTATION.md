# API Documentation

## Base URL

**Local Development:**
```
http://localhost:3001
```

**Production (Render):**
```
https://instagram-pr-team-api.onrender.com
```
*(Replace with your actual Render service URL)*

## Endpoints

### 1. Health Check

Check if the API server is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl https://instagram-pr-team-api.onrender.com/health
```

---

### 2. Scrape Instagram Reel (Internal API Proxy)

Proxy endpoint that forwards requests to your internal API (Cloudflare tunnel).

**Endpoint:** `POST /api/internal/scrape`

**Request Body:**
```json
{
  "url": "https://www.instagram.com/reel/ABC123xyz/"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "shortcode": "ABC123xyz",
    "video_urls": [
      {
        "url": "https://...",
        "width": 1080,
        "height": 1920,
        "type": 101
      }
    ],
    "thumbnail_urls": [
      {
        "url": "https://...",
        "width": 1080,
        "height": 1920
      }
    ],
    "engagement": {
      "like_count": 1234,
      "comment_count": 56,
      "play_count": 5678,
      "view_count": 5678,
      "video_view_count": 5678,
      "organic_video_view_count": null
    },
    "user": {
      "username": "example_user",
      "full_name": "Example User",
      "profile_pic_url": "https://...",
      "is_verified": false,
      "is_private": false
    },
    "caption": "Post caption text...",
    "timestamp": 1704067200,
    "video_duration": 15
  },
  "shortcode": "ABC123xyz",
  "filename": null
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "URL is required"
}
```

**503 Service Unavailable:**
```json
{
  "success": false,
  "error": "Internal API service unavailable. The Cloudflare tunnel may be down. Please check if the tunnel is running.",
  "details": "fetch failed"
}
```

**504 Gateway Timeout:**
```json
{
  "success": false,
  "error": "Request timeout. The internal API took too long to respond."
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Example:**
```bash
curl -X POST https://instagram-pr-team-api.onrender.com/api/internal/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/ABC123xyz/"}'
```

---

### 3. Fetch Reel from Apify (Single)

Fetch a single Instagram reel using Apify.

**Endpoint:** `POST /api/apify/reel`

**Request Body:**
```json
{
  "url": "https://www.instagram.com/reel/ABC123xyz/",
  "apiKey": "apify_api_xxxxxxxxxxxxx" // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "items": [
    {
      "id": "shortcode_ABC123xyz",
      "shortcode": "ABC123xyz",
      "ownerusername": "example_user",
      "ownerfullname": "Example User",
      "caption": "Post caption...",
      "likescount": 1234,
      "commentscount": 56,
      "videoviewcount": 5678,
      "videoplaycount": 5678,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "takenat": "2024-01-01T00:00:00.000Z",
      "video_duration": 15,
      "displayurl": "https://...",
      "videourl": "https://...",
      "thumbnailurl": "https://...",
      "producttype": "clips",
      "url": "https://www.instagram.com/p/ABC123xyz/",
      "permalink": "https://www.instagram.com/p/ABC123xyz/",
      "inputurl": "https://www.instagram.com/reel/ABC123xyz/"
    }
  ]
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "URL is required"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Example:**
```bash
curl -X POST https://instagram-pr-team-api.onrender.com/api/apify/reel \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/reel/ABC123xyz/",
    "apiKey": "apify_api_xxxxxxxxxxxxx"
  }'
```

---

### 4. Fetch Multiple Reels from Apify (Bulk)

Fetch multiple Instagram reels using Apify in bulk.

**Endpoint:** `POST /api/apify/reels`

**Request Body:**
```json
{
  "urls": [
    "https://www.instagram.com/reel/ABC123xyz/",
    "https://www.instagram.com/reel/DEF456uvw/",
    "https://www.instagram.com/reel/GHI789rst/"
  ],
  "apiKey": "apify_api_xxxxxxxxxxxxx" // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "items": [
    {
      "id": "shortcode_ABC123xyz",
      "shortcode": "ABC123xyz",
      // ... same structure as single reel
    },
    {
      "id": "shortcode_DEF456uvw",
      "shortcode": "DEF456uvw",
      // ... same structure as single reel
    }
    // ... more items
  ]
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "error": "URLs array is required"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Example:**
```bash
curl -X POST https://instagram-pr-team-api.onrender.com/api/apify/reels \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.instagram.com/reel/ABC123xyz/",
      "https://www.instagram.com/reel/DEF456uvw/"
    ],
    "apiKey": "apify_api_xxxxxxxxxxxxx"
  }'
```

---

## Environment Variables

### Required for API Service

| Variable | Description | Example |
|----------|-------------|---------|
| `INTERNAL_API_URL` | Cloudflare tunnel URL for internal API | `https://abc123.trycloudflare.com` |
| `PORT` | Server port (Render sets this automatically) | `10000` |
| `NODE_ENV` | Environment | `production` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `APIFY_TOKEN` | Default Apify API token (if not provided in request) | `apify_api_xxxxxxxxxxxxx` |

---

## CORS

The API server is configured to allow all origins in development and production:

```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Rate Limiting

The frontend implements rate limiting:
- **Limit:** 20 requests per 5 minutes
- **Delay:** ~15 seconds between requests
- **Queue:** Requests are queued and processed in priority order

---

## Timeouts

- **Request Timeout:** 30 seconds
- If the internal API doesn't respond within 30 seconds, a 504 Gateway Timeout is returned

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

---

## Usage Examples

### JavaScript/TypeScript (Frontend)

```typescript
// Using fetch
const response = await fetch('https://instagram-pr-team-api.onrender.com/api/internal/scrape', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://www.instagram.com/reel/ABC123xyz/'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Reel data:', data.data);
} else {
  console.error('Error:', data.error);
}
```

### Python

```python
import requests

url = 'https://instagram-pr-team-api.onrender.com/api/internal/scrape'
payload = {
    'url': 'https://www.instagram.com/reel/ABC123xyz/'
}

response = requests.post(url, json=payload)
data = response.json()

if data.get('success'):
    print('Reel data:', data['data'])
else:
    print('Error:', data['error'])
```

### cURL

```bash
# Health check
curl https://instagram-pr-team-api.onrender.com/health

# Scrape reel
curl -X POST https://instagram-pr-team-api.onrender.com/api/internal/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/ABC123xyz/"}'
```

---

## Testing

### Test Health Endpoint
```bash
curl https://instagram-pr-team-api.onrender.com/health
```

Expected response:
```json
{"status":"ok"}
```

### Test Scrape Endpoint
```bash
curl -X POST https://instagram-pr-team-api.onrender.com/api/internal/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/YOUR_REEL_ID/"}'
```

---

## Notes

- All endpoints require `Content-Type: application/json` header for POST requests
- The API server proxies requests to your internal API (Cloudflare tunnel)
- If the Cloudflare tunnel is down, you'll get a 503 error
- The API server handles CORS automatically
- Rate limiting is implemented on the frontend, not the API server

