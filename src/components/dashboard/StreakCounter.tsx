import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  streak: number;
  isActiveToday: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const StreakCounter = ({ streak, isActiveToday, className, size = "md" }: StreakCounterProps) => {
  const sizeClasses = {
    sm: "text-sm gap-1",
    md: "text-base gap-1.5",
    lg: "text-lg gap-2",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const isOnFire = streak >= 3;
  const isStreaking = streak >= 1;

  return (
    <div
      className={cn(
        "inline-flex items-center font-bold rounded-full px-3 py-1 transition-all",
        sizeClasses[size],
        isOnFire 
          ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 animate-pulse" 
          : isStreaking 
            ? "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-600 dark:from-orange-900/30 dark:to-amber-900/30 dark:text-orange-400"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
        className
      )}
      title={`${streak} day streak${isActiveToday ? " - Posted today! 🎉" : " - Post today to keep your streak!"}`}
    >
      <Flame 
        className={cn(
          iconSizes[size],
          isOnFire && "animate-bounce",
          isStreaking ? "text-orange-500" : "text-slate-400",
          isOnFire && "text-white"
        )} 
      />
      <span className="font-extrabold tabular-nums">{streak}</span>
      {isOnFire && <span className="text-xs ml-1">🔥</span>}
    </div>
  );
};

export default StreakCounter;

