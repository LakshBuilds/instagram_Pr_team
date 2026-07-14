import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";

interface Reel {
  id: string;
  ownerusername: string | null;
  takenat: string | null;
  created_by_email?: string | null;
}

interface MonthlyCreatorsChartProps {
  reels: Reel[];
}

const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = (payload[0]?.value || 0) + (payload[1]?.value || 0);
  return (
    <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">🆕 New creators: {payload[0]?.value}</p>
      <p className="text-blue-500 dark:text-blue-400">🔁 Returning: {payload[1]?.value}</p>
      <p className="text-foreground font-medium mt-1">Total: {total}</p>
    </div>
  );
};

export default function MonthlyCreatorsChart({ reels }: MonthlyCreatorsChartProps) {
  const data = useMemo(() => {
    // Build month → set of creators
    const monthlyCreators: Record<string, Set<string>> = {};
    const firstSeen: Record<string, string> = {};  // creator -> first month key

    reels.forEach((reel) => {
      if (!reel.takenat || !reel.ownerusername) return;
      const creator = reel.ownerusername.toLowerCase().trim();
      if (!creator) return;

      const d = new Date(reel.takenat);
      const monthKey = `${MONTH_ORDER[d.getMonth()]} ${d.getFullYear()}`;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

      if (!monthlyCreators[monthKey]) monthlyCreators[monthKey] = new Set();
      monthlyCreators[monthKey].add(creator);

      // Track first seen month (by sort key)
      if (!firstSeen[creator] || sortKey < firstSeen[creator]) {
        firstSeen[creator] = sortKey;
      }
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyCreators).sort((a, b) => {
      const [ma, ya] = a.split(' ');
      const [mb, yb] = b.split(' ');
      return (Number(ya)*12 + MONTH_ORDER.indexOf(ma)) - (Number(yb)*12 + MONTH_ORDER.indexOf(mb));
    });

    return sortedMonths.map((monthKey) => {
      const creators = monthlyCreators[monthKey];
      const [, year] = monthKey.split(' ');
      const [monthName] = monthKey.split(' ');
      const monthIdx = MONTH_ORDER.indexOf(monthName);
      const sortKey = `${year}-${String(monthIdx+1).padStart(2,'0')}`;

      let newCount = 0;
      let returningCount = 0;

      creators.forEach((creator) => {
        if (firstSeen[creator] === sortKey) {
          newCount++;
        } else {
          returningCount++;
        }
      });

      return {
        month: monthKey,
        new: newCount,
        returning: returningCount,
        total: creators.size,
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
          New creators (first time) vs returning creators each month
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
              formatter={(value) => value === "new" ? "🆕 New creators" : "🔁 Returning"}
            />
            <Bar dataKey="new" name="new" stackId="a" fill="hsl(var(--chart-2))" radius={[0,0,0,0]} maxBarSize={50} />
            <Bar dataKey="returning" name="returning" stackId="a" fill="hsl(var(--chart-4))" radius={[4,4,0,0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>

        {latestMonth && (
          <div className="mt-3 flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px] rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-2 text-center">
              <p className="text-xl font-bold text-emerald-600">{latestMonth.new}</p>
              <p className="text-xs text-muted-foreground">New this month</p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2 text-center">
              <p className="text-xl font-bold text-blue-500">{latestMonth.returning}</p>
              <p className="text-xs text-muted-foreground">Returning</p>
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
