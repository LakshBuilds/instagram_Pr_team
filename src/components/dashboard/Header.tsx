import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, BarChart3, LayoutDashboard, Download, Languages, MapPin, Navigation, Zap } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser, useClerk } from "@clerk/clerk-react";
import { getApiProvider, setApiProvider, getApiProviderName, ApiProvider } from "@/lib/apiProvider";
import { getRateLimitStatus } from "@/lib/internalApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  "All",
  "Hinglish",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Urdu",
  "Kannada",
  "Odia",
  "Malayalam",
  "Punjabi",
  "Assamese",
  "Maithili",
  "Konkani",
  "Sindhi",
  "Kashmiri",
  "Dogri",
  "Manipuri (Meiteilon)",
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLanguage = searchParams.get("language") || "All";
  const selectedLocation = searchParams.get("location") || "All";
  const viewMode = searchParams.get("view") || "table"; // table or map
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [apiProvider, setApiProviderState] = useState<ApiProvider>(getApiProvider());
  const [rateLimitInfo, setRateLimitInfo] = useState(getRateLimitStatus());
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();

  // Don't render until user is loaded
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

  const handleLanguageChange = (language: string) => {
    if (language === "All") {
      searchParams.delete("language");
    } else {
      searchParams.set("language", language);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleViewChange = (view: string) => {
    if (view === "table") {
      searchParams.delete("view");
    } else {
      searchParams.set("view", view);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleLocationChange = (location: string) => {
    if (location === "All") {
      searchParams.delete("location");
    } else {
      searchParams.set("location", location);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleApiProviderChange = (provider: string) => {
    const newProvider = provider as ApiProvider;
    setApiProvider(newProvider);
    setApiProviderState(newProvider);
    toast.success(`Switched to ${getApiProviderName(newProvider)}`);
  };

  // Update rate limit info periodically
  useEffect(() => {
    if (apiProvider === 'internal') {
      const interval = setInterval(() => {
        setRateLimitInfo(getRateLimitStatus());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [apiProvider]);

  const userName = user?.fullName || "User";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  const isAnalyticsPage = location.pathname === "/analytics";
  const isImportReelPage = location.pathname === "/import-reel";
  const isDashboardPage = location.pathname === "/";

  // Fetch available locations
  useEffect(() => {
    const fetchLocations = async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("locationname")
        .not("locationname", "is", null);
      
      if (!error && data) {
        const uniqueLocations = Array.from(
          new Set(data.map(r => r.locationname).filter(Boolean))
        ).sort() as string[];
        setAvailableLocations(uniqueLocations);
      }
    };
    
    if (isDashboardPage) {
      fetchLocations();
    }
  }, [isDashboardPage]);

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* <img src="/image.png" alt="Logo" className="w-10 h-10 rounded-full object-cover" /> */}
          <div>
            {/* <h1 className="text-xl font-bold">PR Team</h1> */}
            {/* <p className="text-sm text-muted-foreground">Dashboard</p> */}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-2">
            <Button
              variant={!isAnalyticsPage && !isImportReelPage ? "default" : "ghost"}
              onClick={() => navigate("/")}
              className={!isAnalyticsPage && !isImportReelPage ? "bg-gradient-instagram" : ""}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={isImportReelPage ? "default" : "ghost"}
              onClick={() => navigate("/import-reel")}
              className={isImportReelPage ? "bg-gradient-instagram" : ""}
            >
              <Download className="h-4 w-4 mr-2" />
              Import Reel
            </Button>
            <Button
              variant={isAnalyticsPage ? "default" : "ghost"}
              onClick={() => navigate("/analytics")}
              className={isAnalyticsPage ? "bg-gradient-instagram" : ""}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Select value={apiProvider} onValueChange={handleApiProviderChange}>
              <SelectTrigger className="w-[180px]">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue>
                  {apiProvider === 'internal' ? 'Internal API' : 'External API'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External API (Apify)</SelectItem>
                <SelectItem value="internal">
                  Internal API
                  {apiProvider === 'internal' && rateLimitInfo.requestsInWindow > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({rateLimitInfo.requestsInWindow}/{rateLimitInfo.limit})
                    </span>
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
            {isDashboardPage && (
              <>
                <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="w-[180px]">
                    <Languages className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Language">
                      Language: {selectedLanguage}
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
                <Select value={selectedLocation} onValueChange={handleLocationChange}>
                  <SelectTrigger className="w-[180px]">
                    <Navigation className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Location">
                      Location: {selectedLocation}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    {availableLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={viewMode === "map" ? "default" : "ghost"}
                  onClick={() => handleViewChange(viewMode === "map" ? "table" : "map")}
                  className={viewMode === "map" ? "bg-gradient-instagram" : ""}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {viewMode === "map" ? "Map View" : "Table View"}
                </Button>
              </>
            )}
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
