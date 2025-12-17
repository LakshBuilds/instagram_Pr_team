import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AchievementData } from "@/lib/streakCalculator";

interface AchievementBadgeProps {
  achievement: AchievementData;
  className?: string;
}

const AchievementBadge = ({ achievement, className }: AchievementBadgeProps) => {
  const { name, description, criteria, icon, bgColor, isUnlocked, progress } = achievement;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-300",
        isUnlocked
          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:-translate-y-1"
          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75",
        className
      )}
    >
      {/* Badge Icon */}
      <div className="relative mb-4">
        {/* Hexagon Background */}
        <div
          className={cn(
            "relative w-24 h-24 flex items-center justify-center",
            !isUnlocked && "grayscale"
          )}
        >
          {/* Outer hexagon */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <polygon
              points="50,2 95,25 95,75 50,98 5,75 5,25"
              className={cn(
                "transition-all duration-500",
                isUnlocked
                  ? `fill-current ${achievement.color}`
                  : "fill-slate-300 dark:fill-slate-600"
              )}
              style={{
                filter: isUnlocked ? "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))" : "none",
              }}
            />
            <polygon
              points="50,10 88,30 88,70 50,90 12,70 12,30"
              className={cn(
                "transition-all duration-500",
                isUnlocked
                  ? "fill-white dark:fill-slate-800"
                  : "fill-slate-200 dark:fill-slate-700"
              )}
            />
          </svg>
          
          {/* Icon or Lock */}
          <div className="relative z-10 text-4xl">
            {isUnlocked ? (
              <span className="animate-bounce-slow">{icon}</span>
            ) : (
              <Lock className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            )}
          </div>
        </div>

        {/* Badge Label */}
        <div
          className={cn(
            "absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap shadow-lg",
            isUnlocked
              ? `bg-gradient-to-r ${bgColor}`
              : "bg-slate-400 dark:bg-slate-600"
          )}
        >
          {name}
        </div>
      </div>

      {/* Progress Section */}
      <div className="w-full mt-4 space-y-2">
        {/* Progress Percentage */}
        <div className="text-center">
          <span
            className={cn(
              "text-lg font-bold",
              isUnlocked
                ? achievement.color
                : "text-slate-400 dark:text-slate-500"
            )}
          >
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              isUnlocked
                ? `bg-gradient-to-r ${bgColor}`
                : "bg-slate-400 dark:bg-slate-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Criteria */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-2">
          {criteria}
        </p>
      </div>

      {/* Unlocked Glow Effect */}
      {isUnlocked && (
        <div
          className={cn(
            "absolute inset-0 rounded-2xl opacity-20 blur-xl -z-10",
            `bg-gradient-to-r ${bgColor}`
          )}
        />
      )}
    </div>
  );
};

export default AchievementBadge;


