import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";

interface Reel {
  id: string;
  ownerusername: string | null;
  takenat: string | null;
  payout?: number | string | null;
  created_by_email?: string | null;
}

interface MonthlyCreatorsChartProps {
  reels: Reel[];
}

const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Creators are tiered by how much they were paid within a given month.
const MACRO_THRESHOLD = 3500;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const nano = payload.find((p: any) => p.dataKey === "nano")?.value || 0;
  const macro = payload.find((p: any) => p.dataKey === "macro")?.value || 0;
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <p className="text-blue-500 dark:text-blue-400">🌱 Nano (&lt; ₹3.5k): {nano}</p>
      <p className="text-emerald-600 dark:text-emerald-400">🚀 Macro (≥ ₹3.5k): {macro}</p>
      <p className="text-foreground font-medium mt-1">Total: {nano + macro}</p>
    </div>
  );
};

export default function MonthlyCreatorsChart({ reels }: MonthlyCreatorsChartProps) {
  const data = useMemo(() => {
    // Build month → (creator → total payout that month)
    const monthlyCreatorPayout: Record<string, Record<string, number>> = {};

    reels.forEach((reel) => {
      if (!reel.takenat || !reel.ownerusername) return;
      const creator = reel.ownerusername.toLowerCase().trim();
      if (!creator) return;

      const d = new Date(reel.takenat);
      const monthKey = `${MONTH_ORDER[d.getMonth()]} ${d.getFullYear()}`;
      const payout = parseFloat(String(reel.payout ?? 0)) || 0;

      if (!monthlyCreatorPayout[monthKey]) monthlyCreatorPayout[monthKey] = {};
      monthlyCreatorPayout[monthKey][creator] =
        (monthlyCreatorPayout[monthKey][creator] || 0) + payout;
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyCreatorPayout).sort((a, b) => {
      const [ma, ya] = a.split(' ');
      const [mb, yb] = b.split(' ');
      return (Number(ya)*12 + MONTH_ORDER.indexOf(ma)) - (Number(yb)*12 + MONTH_ORDER.indexOf(mb));
    });

    return sortedMonths.map((monthKey) => {
      const creators = monthlyCreatorPayout[monthKey];

      let nanoCount = 0;
      let macroCount = 0;

      Object.values(creators).forEach((total) => {
        if (total >= MACRO_THRESHOLD) {
          macroCount++;
        } else {
          nanoCount++;
        }
      });

      return {
        month: monthKey,
        nano: nanoCount,
        macro: macroCount,
        total: nanoCount + macroCount,
      };
    });
  }, [reels]);

  const totalUnique = useMemo(() => {
    const allCreators = new Set<string>();
    reels.forEach(r => {
      if (r.ownerusername) allCreators.add(r.ownerusername.toLowerCase().trim());
    });
    return allCreators.size;
  }, [reels]);

  const latestMonth = data[data.length - 1];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Monthly Creator Activity</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-500">{totalUnique.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total unique creators</p>
          </div>
        </div>
        <CardDescription>
          Nano (paid &lt; ₹3,500) vs macro (paid ≥ ₹3,500) creators each month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => value === "nano" ? "🌱 Nano (< ₹3.5k)" : "🚀 Macro (≥ ₹3.5k)"}
            />
            <Bar dataKey="nano" name="nano" stackId="a" fill="hsl(var(--chart-4))" radius={[0,0,0,0]} maxBarSize={50} />
            <Bar dataKey="macro" name="macro" stackId="a" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>

        {latestMonth && (
          <div className="mt-3 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px] rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2 text-center">
              <p className="text-xl font-bold text-blue-500">{latestMonth.nano}</p>
              <p className="text-xs text-muted-foreground">Nano this month</p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-2 text-center">
              <p className="text-xl font-bold text-emerald-600">{latestMonth.macro}</p>
              <p className="text-xs text-muted-foreground">Macro this month</p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-2 text-center">
              <p className="text-xl font-bold text-foreground">{latestMonth.total}</p>
              <p className="text-xs text-muted-foreground">Total active</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
