import { startOfDay, differenceInDays, isWeekend, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

interface Reel {
  id: string;
  takenat: string | null;
  created_by_email?: string | null;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalPostingDays: number;
  totalReels: number;
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

  if (postingDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalPostingDays: 0,
      totalReels: userReels.length,
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
    {
      id: "daily-dynamo",
      name: "Daily Dynamo",
      description: "Post a reel for 7 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 7)}/7 days`,
      icon: "🔥",
      color: "text-orange-500",
      bgColor: "from-orange-400 to-red-500",
      isUnlocked: streakData.longestStreak >= 7,
      progress: Math.min((streakData.currentStreak / 7) * 100, 100),
    },
    {
      id: "streak-sovereign",
      name: "Streak Sovereign",
      description: "Post a reel for 30 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 30)}/30 days`,
      icon: "👑",
      color: "text-green-500",
      bgColor: "from-green-400 to-emerald-600",
      isUnlocked: streakData.longestStreak >= 30,
      progress: Math.min((streakData.currentStreak / 30) * 100, 100),
    },
    {
      id: "weekend-creator",
      name: "Weekend Creator",
      description: "Post on 4 separate weekends this month",
      criteria: `${Math.min(weekendPostsThisMonth, 4)}/4 weekends`,
      icon: "📅",
      color: "text-blue-500",
      bgColor: "from-blue-400 to-cyan-500",
      isUnlocked: weekendPostsThisMonth >= 4,
      progress: Math.min((weekendPostsThisMonth / 4) * 100, 100),
    },
    {
      id: "power-month",
      name: "Power Month",
      description: "Post 20 reels in a single month",
      criteria: `${Math.min(postsThisMonth, 20)}/20 reels`,
      icon: "⚡",
      color: "text-purple-500",
      bgColor: "from-purple-400 to-violet-600",
      isUnlocked: postsThisMonth >= 20,
      progress: Math.min((postsThisMonth / 20) * 100, 100),
    },
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
    {
      id: "idea-generator",
      name: "Idea Generator",
      description: "Track content ideas for 14 consecutive days",
      criteria: `${Math.min(streakData.currentStreak, 14)}/14 days`,
      icon: "💡",
      color: "text-orange-500",
      bgColor: "from-orange-400 to-red-500",
      isUnlocked: streakData.longestStreak >= 14,
      progress: Math.min((streakData.currentStreak / 14) * 100, 100),
    },
    {
      id: "the-finisher",
      name: "The Finisher",
      description: "Complete a 7-day viral challenge",
      criteria: streakData.longestStreak >= 7 ? "Challenge Complete!" : `${Math.min(streakData.currentStreak, 7)}/7 days`,
      icon: "🏁",
      color: "text-yellow-500",
      bgColor: "from-yellow-400 to-amber-500",
      isUnlocked: streakData.longestStreak >= 7,
      progress: Math.min((streakData.currentStreak / 7) * 100, 100),
    },
  ];

  return achievements;
}

