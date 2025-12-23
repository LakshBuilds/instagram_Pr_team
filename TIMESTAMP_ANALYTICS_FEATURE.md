# Timestamp-Based Analytics Feature

## Overview

Ye feature CEO ki requirement ke according implement kiya gaya hai:
- **Views count timestamp based** - Posting date nahi, update timestamp ke hisab se views calculate hote hain
- **Old videos ka bhi views count** - Agar 1 week data chahiye toh purani videos ke views bhi include hote hain
- **Decay factor** - Purani reels ko kam frequently update karna
- **Smart refresh** - Daily 1-2 baar intelligent reel update

## New Files Created

### 1. Database Migration
**File:** `supabase/migrations/20241214_views_history.sql`

Creates:
- `views_history` table - Stores snapshots of views at different timestamps
- `decay_priority` column in reels - Priority for refresh (100=new, 10=old)
- `last_refresh_at` column - When reel was last updated
- Database functions for views growth calculation

### 2. Views History Service
**File:** `src/lib/viewsHistory.ts`

Functions:
- `calculateDecayPriority()` - Calculate priority based on reel age
- `recordViewsSnapshot()` - Save views snapshot after each update
- `getReelsForRefresh()` - Get reels sorted by refresh priority
- `getViewsInRange()` - Get views growth in date range (timestamp-based)
- `getTotalViewsGrowth()` - Get total views growth summary

### 3. Smart Refresh Service
**File:** `src/lib/smartRefresh.ts`

Functions:
- `refreshSingleReel()` - Refresh one reel and record snapshot
- `smartBatchRefresh()` - Batch refresh with decay priority
- `getRefreshRecommendation()` - Get recommendation for refresh

### 4. UI Components
**Files:**
- `src/components/analytics/ViewsGrowthChart.tsx` - Chart for views growth
- `src/components/analytics/SmartRefreshPanel.tsx` - Smart refresh control panel

### 5. Updated Analytics Page
**File:** `src/pages/Analytics.tsx`

New features:
- Toggle for timestamp-based vs posting-date analytics
- Views Growth chart
- Smart Refresh tab
- Timestamp-based metrics display

## How It Works

### Decay Priority System
```
0-7 days old:   Priority 100 (update every time)
8-14 days old:  Priority 80  (high priority)
15-30 days old: Priority 60  (medium priority)
31-60 days old: Priority 40  (low priority)
61-90 days old: Priority 20  (very low priority)
90+ days old:   Priority 10  (rarely update)
```

### Smart Refresh Logic
1. Get all reels sorted by: `decay_priority × days_since_refresh`
2. Higher score = higher priority for refresh
3. New reels that haven't been refreshed recently come first
4. Old reels only get refreshed occasionally

### Timestamp-Based Analytics
- **Old way:** Views counted by posting date (takenat)
- **New way:** Views counted by update timestamp (recorded_at)

Example:
- Reel posted on Dec 1st with 1000 views
- Updated on Dec 10th with 5000 views
- Updated on Dec 15th with 8000 views

If you select Dec 10-15 date range:
- **Old way:** Would show 0 (reel not posted in this range)
- **New way:** Shows +3000 views growth (8000 - 5000)

## Usage

### 1. Run Migration
```bash
node run-views-history-migration.mjs
```

Or run SQL directly in Supabase dashboard.

### 2. Enable Timestamp Analytics
In Analytics page, toggle "Timestamp-based Views" switch.

### 3. Use Smart Refresh
Go to "Smart Refresh" tab and click refresh button.
System will automatically prioritize which reels to update.

### 4. Daily Refresh Routine
- Refresh 1-2 times per day
- System recommends how many reels to refresh
- New reels get updated more frequently
- Old reels get updated less frequently

## API Integration

When refreshing reels, the system:
1. Calls internal API to get latest data
2. Updates reel in database
3. Records views snapshot in views_history
4. Updates decay_priority and last_refresh_at

## Benefits

1. **Accurate Growth Tracking** - See actual views growth, not just total views
2. **Efficient API Usage** - Don't waste API calls on old reels
3. **Better Insights** - Understand which reels are still growing
4. **Resource Optimization** - Decay factor reduces unnecessary updates

## Database Schema

### views_history Table
```sql
id              uuid PRIMARY KEY
reel_id         text REFERENCES reels(id)
shortcode       text
ownerusername   text
videoplaycount  integer
videoviewcount  integer
likescount      integer
commentscount   integer
recorded_at     timestamptz  -- When snapshot was taken
takenat         timestamptz  -- Original posting date
updated_by_email text
```

### New Columns in reels Table
```sql
decay_priority   integer DEFAULT 100
last_refresh_at  timestamptz
refresh_count    integer DEFAULT 0
```

## Notes

- First time use: No views history data, need to refresh reels first
- More refreshes = more accurate timestamp-based analytics
- Decay factor can be adjusted in `calculateDecayPriority()` function