import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, LayoutDashboard } from "lucide-react";
import { signOut } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

interface HeaderProps {
  userEmail: string;
  userName: string;
}

const Header = ({ userEmail, userName }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const isAnalyticsPage = location.pathname === "/analytics";

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-instagram rounded-full" />
          <div>
            <h1 className="text-xl font-bold">Instagram Creators</h1>
            <p className="text-sm text-muted-foreground">Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-2">
            <Button
              variant={!isAnalyticsPage ? "default" : "ghost"}
              onClick={() => navigate("/")}
              className={!isAnalyticsPage ? "bg-gradient-instagram" : ""}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={isAnalyticsPage ? "default" : "ghost"}
              onClick={() => navigate("/analytics")}
              className={isAnalyticsPage ? "bg-gradient-instagram" : ""}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </nav>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Avatar>
            <AvatarFallback className="bg-gradient-instagram text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <Button
            onClick={handleLogout}
            size="icon"
            variant="ghost"
            className="rounded-full"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
