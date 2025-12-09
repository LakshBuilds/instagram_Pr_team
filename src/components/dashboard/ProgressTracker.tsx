import { useMemo } from "react";
import { Target, TrendingUp, Users, User } from "lucide-react";

interface ProgressTrackerProps {
  yourViews: number;
  teamViews: number;
  target?: number;
  variant: "your-reels" | "team-reels";
}

const TARGET_VIEWS = 1_000_000_000; // 1 Billion

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + "B";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toLocaleString();
};

const formatFullNumber = (num: number): string => {
  return num.toLocaleString();
};

const ProgressTracker = ({ yourViews, teamViews, target = TARGET_VIEWS, variant }: ProgressTrackerProps) => {
  const stats = useMemo(() => {
    const totalViews = teamViews;
    const otherTeamViews = teamViews - yourViews;
    const totalPercentage = Math.min((totalViews / target) * 100, 100);
    const yourPercentage = Math.min((yourViews / target) * 100, 100);
    const yourContributionPercentage = totalViews > 0 ? (yourViews / totalViews) * 100 : 0;
    
    return {
      totalViews,
      otherTeamViews,
      totalPercentage,
      yourPercentage,
      yourContributionPercentage,
      remaining: target - totalViews,
    };
  }, [yourViews, teamViews, target]);

  if (variant === "your-reels") {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        {/* Header */}
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">1 Billion Views Target</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your contribution to the team goal</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalPercentage.toFixed(2)}%
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Achieved</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative mb-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
            {/* Other team members' contribution (gray) */}
            <div
              className="h-full bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600 absolute left-0 top-0 transition-all duration-1000 ease-out"
              style={{ width: `${stats.totalPercentage}%` }}
            />
            {/* Your contribution (blue) - overlays from the left */}
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 absolute left-0 top-0 transition-all duration-1000 ease-out shadow-lg shadow-blue-500/30"
              style={{ width: `${stats.yourPercentage}%` }}
            />
          </div>
          
          {/* Progress markers */}
          <div className="absolute top-6 left-0 right-0 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span>0</span>
            <span>250M</span>
            <span>500M</span>
            <span>750M</span>
            <span>1B</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
          {/* Your Contribution */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatNumber(yourViews)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Your Views</p>
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {stats.yourContributionPercentage.toFixed(1)}% of team
            </p>
          </div>

          {/* Team Total */}
          <div className="text-center border-x border-slate-200 dark:border-slate-700">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 mb-2">
              <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
              {formatNumber(stats.totalViews)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Team Total</p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {stats.totalPercentage.toFixed(2)}% of target
            </p>
          </div>

          {/* Remaining */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-2">
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatNumber(stats.remaining)}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Remaining</p>
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
              {(100 - stats.totalPercentage).toFixed(2)}% to go
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Your Contribution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600 shadow-sm" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Team Members</span>
          </div>
        </div>
      </div>
    );
  }

  // Team Reels variant - simple single color bar
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 p-6 shadow-sm">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Team Progress</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Collective effort towards 1 Billion Views</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {stats.totalPercentage.toFixed(2)}%
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">of Target</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-4">
        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ width: `${stats.totalPercentage}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        
        {/* Progress markers */}
        <div className="absolute top-7 left-0 right-0 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>0</span>
          <span>250M</span>
          <span>500M</span>
          <span>750M</span>
          <span>1B</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-emerald-200 dark:border-emerald-800">
        <div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatNumber(stats.totalViews)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatFullNumber(stats.totalViews)} views achieved
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">
            {formatNumber(stats.remaining)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            views remaining to target
          </p>
        </div>
      </div>

      {/* Milestone indicators */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
        {[
          { milestone: 250_000_000, label: "250M" },
          { milestone: 500_000_000, label: "500M" },
          { milestone: 750_000_000, label: "750M" },
          { milestone: 1_000_000_000, label: "1B" },
        ].map(({ milestone, label }) => (
          <div
            key={milestone}
            className={`text-center p-2 rounded-lg transition-colors ${
              stats.totalViews >= milestone
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-slate-100 dark:bg-slate-800"
            }`}
          >
            <div
              className={`text-sm font-bold ${
                stats.totalViews >= milestone
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {label}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {stats.totalViews >= milestone ? "✓ Reached" : "Milestone"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressTracker;

