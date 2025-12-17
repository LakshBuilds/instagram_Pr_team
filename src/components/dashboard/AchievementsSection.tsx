import { useMemo } from "react";
import { Trophy, Flame, Target, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AchievementBadge from "./AchievementBadge";
import StreakCounter from "./StreakCounter";
import { calculateStreakData, calculateAchievements, StreakData, AchievementData } from "@/lib/streakCalculator";

interface Reel {
  id: string;
  takenat: string | null;
  created_by_email?: string | null;
  videoviewcount?: number | null;
  videoplaycount?: number | null;
  likescount?: number | null;
}

interface AchievementsSectionProps {
  reels: Reel[];
  userEmail?: string;
}

// Format view count to readable string
const formatViewCount = (views: number): string => {
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
};

const AchievementsSection = ({ reels, userEmail }: AchievementsSectionProps) => {
  const streakData = useMemo(() => calculateStreakData(reels, userEmail), [reels, userEmail]);
  const achievements = useMemo(() => calculateAchievements(reels, userEmail), [reels, userEmail]);

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalAchievements = achievements.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Achievements</CardTitle>
              <CardDescription>
                {unlockedCount}/{totalAchievements} badges unlocked
              </CardDescription>
            </div>
          </div>
          
          {/* Streak Summary */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Streak</p>
              <StreakCounter streak={streakData.currentStreak} isActiveToday={streakData.isActiveToday} size="lg" />
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Best Streak</p>
              <div className="flex items-center gap-1.5 text-lg font-bold text-amber-600 dark:text-amber-400">
                <Target className="h-5 w-5" />
                <span>{streakData.longestStreak}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
            <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{streakData.currentStreak}</p>
            <p className="text-xs text-muted-foreground">Day Streak</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20">
            <Trophy className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{streakData.longestStreak}</p>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <Target className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{streakData.totalPostingDays}</p>
            <p className="text-xs text-muted-foreground">Active Days</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
            <div className="text-2xl mb-2">🎬</div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{streakData.totalReels}</p>
            <p className="text-xs text-muted-foreground">Total Reels</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20">
            <Eye className="h-6 w-6 mx-auto mb-2 text-sky-500" />
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{formatViewCount(streakData.totalViews)}</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </div>
        </div>

        {/* Today's Status */}
        {!streakData.isActiveToday && streakData.currentStreak > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-3">
              <Flame className="h-6 w-6 text-orange-500 animate-pulse" />
              <div>
                <p className="font-semibold text-orange-700 dark:text-orange-300">
                  Keep your streak alive! 🔥
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Post a reel today to maintain your {streakData.currentStreak}-day streak
                </p>
              </div>
            </div>
          </div>
        )}

        {streakData.isActiveToday && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-300">
                  Great job! You've posted today!
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Your streak is now at {streakData.currentStreak} day{streakData.currentStreak !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Achievement Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {achievements.map((achievement) => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AchievementsSection;


