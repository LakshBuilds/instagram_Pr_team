import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Heart, MessageSquare, Eye, DollarSign } from "lucide-react";

interface StatsCardsProps {
  totalReels: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalPayout: number;
}

const StatsCards = ({ totalReels, totalLikes, totalComments, totalViews, totalPayout }: StatsCardsProps) => {
  const stats = [
    { title: "Total Reels", value: totalReels.toLocaleString(), icon: TrendingUp, color: "text-chart-1" },
    { title: "Total Likes", value: totalLikes.toLocaleString(), icon: Heart, color: "text-chart-2" },
    { title: "Total Comments", value: totalComments.toLocaleString(), icon: MessageSquare, color: "text-chart-3" },
    { title: "Total Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-chart-4" },
    { title: "Total Payout", value: `$${totalPayout.toFixed(2)}`, icon: DollarSign, color: "text-chart-5" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StatsCards;
