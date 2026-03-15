import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, LayoutDashboard, Download, Languages } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useUser, useClerk } from "@clerk/clerk-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/constants";

const CATEGORIES = [
  "All", "Entertainment", "Education", "Music", "Gaming", "News",
  "Sports", "Comedy", "Tech", "Vlogs", "How-to", "Travel", "Food", "Fashion", "Fitness",
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "All";
  const selectedLanguage = searchParams.get("language") || "All";
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isUserLoaded) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  const handleCategoryChange = (category: string) => {
    if (category === "All") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", category);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleLanguageChange = (language: string) => {
    if (language === "All") {
      searchParams.delete("language");
    } else {
      searchParams.set("language", language);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const userName = user?.fullName || "User";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  const isAnalyticsPage = location.pathname === "/analytics";
  const isImportVideoPage = location.pathname === "/import-video";
  const isDashboardPage = location.pathname === "/";

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-youtube rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-2">
            <Button
              variant={isDashboardPage ? "default" : "ghost"}
              onClick={() => navigate("/")}
              className={isDashboardPage ? "bg-gradient-youtube" : ""}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={isImportVideoPage ? "default" : "ghost"}
              onClick={() => navigate("/import-video")}
              className={isImportVideoPage ? "bg-gradient-youtube" : ""}
            >
              <Download className="h-4 w-4 mr-2" />
              Import Video
            </Button>
            <Button
              variant={isAnalyticsPage ? "default" : "ghost"}
              onClick={() => navigate("/analytics")}
              className={isAnalyticsPage ? "bg-gradient-youtube" : ""}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            {isDashboardPage && (
              <>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Category">
                      Category: {selectedCategory}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[160px]">
                    <Languages className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Language">
                      {selectedLanguage}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </nav>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Avatar>
            <AvatarFallback className="bg-gradient-youtube text-white">
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
