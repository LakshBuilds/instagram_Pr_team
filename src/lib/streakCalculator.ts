import { startOfDay, differenceInDays, isWeekend, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

/**
 * Format view count to readable string (e.g., 1.5M, 500K)
 */
function formatViews(views: number): string {
  if (views >= 1000000000) {
    return `${(views / 1000000000).toFixed(1)}B`;
  }
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

interface Reel {
  id: string;
  takenat: string | null;
  created_by_email?: string | null;
  videoviewcount?: number | null;
  videoplaycount?: number | null;
  likescount?: number | null;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalPostingDays: number;
  totalReels: number;
  totalViews: number;
  totalLikes: number;
  lastPostDate: Date | null;
  isActiveToday: boolean;
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  criteria: string;
  icon: string;
  color: string;
  bgColor: string;
  isUnlocked: boolean;
  progress: number; // 0-100
  unlockedAt?: Date;
}

/**
 * Calculate streak data from reels
 */
export function calculateStreakData(reels: Reel[], userEmail?: string): StreakData {
  // Filter reels by user if email provided
  const userReels = userEmail 
    ? reels.filter(r => r.created_by_email === userEmail)
    : reels;

  // Get unique posting dates (only dates, not times)
  const postingDates = userReels
    .filter(r => r.takenat)
    .map(r => startOfDay(new Date(r.takenat!)).getTime())
    .filter((date, index, self) => self.indexOf(date) === index) // Unique dates
    .sort((a, b) => b - a); // Sort descending (most recent first)

  // Calculate total views and likes
  const totalViews = userReels.reduce((sum, r) => {
    const views = r.videoplaycount ?? r.videoviewcount ?? 0;
    return sum + (typeof views === 'number' ? views : 0);
  }, 0);
  
  const totalLikes = userReels.reduce((sum, r) => {
    const likes = r.likescount ?? 0;
    return sum + (typeof likes === 'number' ? likes : 0);
  }, 0);

  if (postingDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalPostingDays: 0,
      totalReels: userReels.length,
      totalViews,
      totalLikes,
      lastPostDate: null,
      isActiveToday: false,
    };
  }

  const today = startOfDay(new Date()).getTime();
  const yesterday = today - 86400000; // 24 hours in ms
  
  // Check if posted today
  const isActiveToday = postingDates.includes(today);
  
  // Calculate current streak
  let currentStreak = 0;
  let checkDate = isActiveToday ? today : yesterday;
  
  // Only count streak if posted today or yesterday
  if (postingDates.includes(today) || postingDates.includes(yesterday)) {
    for (const date of postingDates) {
      if (date === checkDate) {
        currentStreak++;
        checkDate -= 86400000; // Go back one day
      } else if (date < checkDate) {
        break; // Gap in streak
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  const sortedDatesAsc = [...postingDates].sort((a, b) => a - b);
  
  for (let i = 1; i < sortedDatesAsc.length; i++) {
    const diff = sortedDatesAsc[i] - sortedDatesAsc[i - 1];
    if (diff === 86400000) { // Consecutive day
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    totalPostingDays: postingDates.length,
    totalReels: userReels.length,
    totalViews,
    totalLikes,
    lastPostDate: new Date(postingDates[0]),
    isActiveToday,
  };
}

/**
 * Calculate achievement progress and unlock status
 */
export function calculateAchievements(reels: Reel[], userEmail?: string): AchievementData[] {
  const streakData = calculateStreakData(reels, userEmail);
  
  // Filter reels by user
  const userReels = userEmail 
    ? reels.filter(r => r.created_by_email === userEmail)
    : reels;

  // Calculate weekend posts this month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const weekendPostsThisMonth = new Set(
    userReels
      .filter(r => r.takenat)
      .filter(r => {
        const date = new Date(r.takenat!);
        return isWithinInterval(date, { start: monthStart, end: monthEnd }) && isWeekend(date);
      })
      .map(r => startOfDay(new Date(r.takenat!)).toISOString())
  ).size;

  // Calculate posts this month
  const postsThisMonth = userReels.filter(r => {
    if (!r.takenat) return false;
    const date = new Date(r.takenat);
    return isWithinInterval(date, { start: monthStart, end: monthEnd });
  }).length;

  const achievements: AchievementData[] = [
    // === STREAK ACHIEVEMENTS ===
    {
      id: "first-post",
      name: "First Post",
      description: "Complete your very first reel post",
      criteria: streakData.totalReels >= 1 ? "Completed!" : "Post your first reel",
      icon: "🎬",
      color: "text-amber-600",
      bgColor: "from-amber-500 to-orange-600",
      isUnlocked: streakData.totalReels >= 1,
      progress: streakData.totalReels >= 1 ? 100 : 0,
    },
    {
      id: "daily-dynamo",
      name: "Daily Dynamo",
      description: "Post reels for 7 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 7)}/7 days`,
      icon: "🔥",
      color: "text-orange-500",
      bgColor: "from-orange-400 to-red-500",
      isUnlocked: streakData.longestStreak >= 7,
      progress: Math.min((streakData.currentStreak / 7) * 100, 100),
    },
    {
      id: "streak-master",
      name: "Streak Master",
      description: "Post reels for 14 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 14)}/14 days`,
      icon: "💪",
      color: "text-orange-600",
      bgColor: "from-orange-500 to-red-600",
      isUnlocked: streakData.longestStreak >= 14,
      progress: Math.min((streakData.currentStreak / 14) * 100, 100),
    },
    {
      id: "streak-sovereign",
      name: "Streak Sovereign",
      description: "Post reels for 30 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 30)}/30 days`,
      icon: "👑",
      color: "text-green-500",
      bgColor: "from-green-400 to-emerald-600",
      isUnlocked: streakData.longestStreak >= 30,
      progress: Math.min((streakData.currentStreak / 30) * 100, 100),
    },
    
    // === MONTHLY VOLUME ACHIEVEMENTS ===
    {
      id: "weekend-warrior",
      name: "Weekend Warrior",
      description: "Post 20+ reels on weekends this month",
      criteria: `${Math.min(weekendPostsThisMonth, 20)}/20 weekend reels`,
      icon: "📅",
      color: "text-blue-500",
      bgColor: "from-blue-400 to-cyan-500",
      isUnlocked: weekendPostsThisMonth >= 20,
      progress: Math.min((weekendPostsThisMonth / 20) * 100, 100),
    },
    {
      id: "power-month",
      name: "Power Month",
      description: "Post 100 reels in a single month",
      criteria: `${Math.min(postsThisMonth, 100)}/100 reels`,
      icon: "⚡",
      color: "text-purple-500",
      bgColor: "from-purple-400 to-violet-600",
      isUnlocked: postsThisMonth >= 100,
      progress: Math.min((postsThisMonth / 100) * 100, 100),
    },
    {
      id: "content-machine",
      name: "Content Machine",
      description: "Post 150 reels in a single month",
      criteria: `${Math.min(postsThisMonth, 150)}/150 reels`,
      icon: "🤖",
      color: "text-violet-500",
      bgColor: "from-violet-500 to-purple-700",
      isUnlocked: postsThisMonth >= 150,
      progress: Math.min((postsThisMonth / 150) * 100, 100),
    },
    
    // === TOTAL VOLUME ACHIEVEMENTS ===
    {
      id: "centurion",
      name: "Centurion",
      description: "Reach 100 total reels posted",
      criteria: `${Math.min(streakData.totalReels, 100)}/100 reels`,
      icon: "🎯",
      color: "text-slate-500",
      bgColor: "from-slate-400 to-slate-600",
      isUnlocked: streakData.totalReels >= 100,
      progress: Math.min((streakData.totalReels / 100) * 100, 100),
    },
    {
      id: "viral-factory",
      name: "Viral Factory",
      description: "Reach 500 total reels posted",
      criteria: `${Math.min(streakData.totalReels, 500)}/500 reels`,
      icon: "🏭",
      color: "text-indigo-500",
      bgColor: "from-indigo-400 to-indigo-600",
      isUnlocked: streakData.totalReels >= 500,
      progress: Math.min((streakData.totalReels / 500) * 100, 100),
    },
    {
      id: "legend",
      name: "Legend",
      description: "Reach 1,000 total reels posted",
      criteria: `${Math.min(streakData.totalReels, 1000).toLocaleString()}/1,000 reels`,
      icon: "🏆",
      color: "text-yellow-500",
      bgColor: "from-yellow-400 to-amber-600",
      isUnlocked: streakData.totalReels >= 1000,
      progress: Math.min((streakData.totalReels / 1000) * 100, 100),
    },
    {
      id: "infinity-creator",
      name: "Infinity Creator",
      description: "Reach 5,000 total reels posted",
      criteria: `${Math.min(streakData.totalReels, 5000).toLocaleString()}/5,000 reels`,
      icon: "♾️",
      color: "text-rose-500",
      bgColor: "from-rose-400 to-pink-600",
      isUnlocked: streakData.totalReels >= 5000,
      progress: Math.min((streakData.totalReels / 5000) * 100, 100),
    },
    
    // === VIEW MILESTONES ===
    {
      id: "view-starter",
      name: "View Starter",
      description: "Cross 100K total views",
      criteria: streakData.totalViews >= 100000 ? "100K+ Views!" : `${formatViews(streakData.totalViews)}/100K`,
      icon: "👀",
      color: "text-sky-500",
      bgColor: "from-sky-400 to-blue-500",
      isUnlocked: streakData.totalViews >= 100000,
      progress: Math.min((streakData.totalViews / 100000) * 100, 100),
    },
    {
      id: "million-club",
      name: "Million Club",
      description: "Cross 1 Million total views",
      criteria: streakData.totalViews >= 1000000 ? "1M+ Views!" : `${formatViews(streakData.totalViews)}/1M`,
      icon: "🌟",
      color: "text-amber-500",
      bgColor: "from-amber-400 to-yellow-500",
      isUnlocked: streakData.totalViews >= 1000000,
      progress: Math.min((streakData.totalViews / 1000000) * 100, 100),
    },
    {
      id: "five-million",
      name: "5M Superstar",
      description: "Cross 5 Million total views",
      criteria: streakData.totalViews >= 5000000 ? "5M+ Views!" : `${formatViews(streakData.totalViews)}/5M`,
      icon: "⭐",
      color: "text-yellow-500",
      bgColor: "from-yellow-400 to-orange-500",
      isUnlocked: streakData.totalViews >= 5000000,
      progress: Math.min((streakData.totalViews / 5000000) * 100, 100),
    },
    {
      id: "ten-million",
      name: "10M Icon",
      description: "Cross 10 Million total views",
      criteria: streakData.totalViews >= 10000000 ? "10M+ Views!" : `${formatViews(streakData.totalViews)}/10M`,
      icon: "💫",
      color: "text-orange-500",
      bgColor: "from-orange-400 to-red-500",
      isUnlocked: streakData.totalViews >= 10000000,
      progress: Math.min((streakData.totalViews / 10000000) * 100, 100),
    },
    {
      id: "fifty-million",
      name: "50M Megastar",
      description: "Cross 50 Million total views",
      criteria: streakData.totalViews >= 50000000 ? "50M+ Views!" : `${formatViews(streakData.totalViews)}/50M`,
      icon: "🔥",
      color: "text-red-500",
      bgColor: "from-red-500 to-rose-600",
      isUnlocked: streakData.totalViews >= 50000000,
      progress: Math.min((streakData.totalViews / 50000000) * 100, 100),
    },
    {
      id: "hundred-million",
      name: "100M Legend",
      description: "Cross 100 Million total views",
      criteria: streakData.totalViews >= 100000000 ? "100M+ Views!" : `${formatViews(streakData.totalViews)}/100M`,
      icon: "👑",
      color: "text-purple-500",
      bgColor: "from-purple-500 to-violet-600",
      isUnlocked: streakData.totalViews >= 100000000,
      progress: Math.min((streakData.totalViews / 100000000) * 100, 100),
    },
    {
      id: "billion-views",
      name: "Billion Views",
      description: "Cross 1 Billion total views - THE ULTIMATE!",
      criteria: streakData.totalViews >= 1000000000 ? "1B+ VIEWS! 🎉" : `${formatViews(streakData.totalViews)}/1B`,
      icon: "💎",
      color: "text-cyan-400",
      bgColor: "from-cyan-400 via-blue-500 to-purple-600",
      isUnlocked: streakData.totalViews >= 1000000000,
      progress: Math.min((streakData.totalViews / 1000000000) * 100, 100),
    },
    
    // === LONG-TERM ACHIEVEMENTS ===
    {
      id: "one-year-strong",
      name: "One Year Strong",
      description: "Post content for 365 total days",
      criteria: `${Math.min(streakData.totalPostingDays, 365)}/365 days`,
      icon: "🏅",
      color: "text-cyan-500",
      bgColor: "from-cyan-400 to-teal-500",
      isUnlocked: streakData.totalPostingDays >= 365,
      progress: Math.min((streakData.totalPostingDays / 365) * 100, 100),
    },
  ];

  return achievements;
}


