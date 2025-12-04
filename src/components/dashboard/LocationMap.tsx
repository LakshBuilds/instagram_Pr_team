import { useEffect, useState, useMemo } from "react";
import Map, { Marker, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Eye, Heart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LanguageLocation {
  language: string;
  state: string;
  cities: string[];
  latitude: number | null;
  longitude: number | null;
}

interface Reel {
  id: string;
  locationname: string | null;
  language?: string | null;
  videoplaycount: number | null;
  likescount: number | null;
  commentscount: number | null;
  permalink: string | null;
  ownerusername: string | null;
  caption: string | null;
}

interface LocationMapProps {
  reels: Reel[];
  selectedLanguage?: string | null;
  selectedLocation?: string | null;
}

// City/State to coordinates mapping
const LOCATION_COORDINATES: { [key: string]: { lat: number; lng: number } } = {
  // Major Cities
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "New Delhi": { lat: 28.6139, lng: 77.2090 },
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Bangalore": { lat: 12.9716, lng: 77.5946 },
  "Hyderabad": { lat: 17.3850, lng: 78.4867 },
  "Chennai": { lat: 13.0827, lng: 80.2707 },
  "Kolkata": { lat: 22.5726, lng: 88.3639 },
  "Pune": { lat: 18.5204, lng: 73.8567 },
  "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "Jaipur": { lat: 26.9124, lng: 75.7873 },
  "Lucknow": { lat: 26.8467, lng: 80.9462 },
  "Kanpur": { lat: 26.4499, lng: 80.3319 },
  "Nagpur": { lat: 21.1458, lng: 79.0882 },
  "Indore": { lat: 22.7196, lng: 75.8577 },
  "Thane": { lat: 19.2183, lng: 72.9781 },
  "Bhopal": { lat: 23.2599, lng: 77.4126 },
  "Visakhapatnam": { lat: 17.6868, lng: 83.2185 },
  "Patna": { lat: 25.5941, lng: 85.1376 },
  "Vadodara": { lat: 22.3072, lng: 73.1812 },
  "Ghaziabad": { lat: 28.6692, lng: 77.4538 },
  "Ludhiana": { lat: 30.9010, lng: 75.8573 },
  "Agra": { lat: 27.1767, lng: 78.0081 },
  "Nashik": { lat: 19.9975, lng: 73.7898 },
  "Faridabad": { lat: 28.4089, lng: 77.3178 },
  "Meerut": { lat: 28.9845, lng: 77.7064 },
  "Rajkot": { lat: 22.3039, lng: 70.8022 },
  "Varanasi": { lat: 25.3176, lng: 82.9739 },
  "Srinagar": { lat: 34.0837, lng: 74.7973 },
  "Amritsar": { lat: 31.6340, lng: 74.8723 },
  "Chandigarh": { lat: 30.7333, lng: 76.7794 },
  "Kochi": { lat: 9.9312, lng: 76.2673 },
  "Coimbatore": { lat: 11.0168, lng: 76.9558 },
  "Guwahati": { lat: 26.1445, lng: 91.7362 },
  "Bhubaneswar": { lat: 20.2961, lng: 85.8245 },
  "Dehradun": { lat: 30.3165, lng: 78.0322 },
  "Mysuru": { lat: 12.2958, lng: 76.6394 },
  "Mangalore": { lat: 12.9141, lng: 74.8560 },
  "Imphal": { lat: 24.8170, lng: 93.9368 },
  "Shillong": { lat: 25.5788, lng: 91.8933 },
  "Aizawl": { lat: 23.7271, lng: 92.7176 },
  "Gangtok": { lat: 27.3389, lng: 88.6065 },
  "Panaji": { lat: 15.4909, lng: 73.8278 },
  "Pondicherry": { lat: 11.9416, lng: 79.8083 },
  "Thiruvananthapuram": { lat: 9.9312, lng: 76.2673 },
  "Jodhpur": { lat: 26.2389, lng: 73.0243 },
  "Udaipur": { lat: 24.5854, lng: 73.7125 },
  "Gurgaon": { lat: 28.4089, lng: 77.0378 },
  "Gurugram": { lat: 28.4089, lng: 77.0378 },
  "Noida": { lat: 28.5355, lng: 77.3910 },
  "Greater Noida": { lat: 28.4744, lng: 77.5040 },
  "Chitkara University": { lat: 30.5167, lng: 76.6500 },
  "Chandigarh, India": { lat: 30.7333, lng: 76.7794 },
  "Delhi दिल्ली": { lat: 28.6139, lng: 77.2090 },
  "Mumbai - मुंबई": { lat: 19.0760, lng: 72.8777 },
  "Bangalore, India": { lat: 12.9716, lng: 77.5946 },
  "Chandigarh, India": { lat: 30.7333, lng: 76.7794 },
};

// Extract city/state from location string
const extractLocation = (location: string | null): string | null => {
  if (!location) return null;
  
  // Try direct match first
  if (LOCATION_COORDINATES[location]) {
    return location;
  }
  
  // Try to extract city name from location string
  const locationLower = location.toLowerCase();
  
  // Check for common patterns
  for (const [key, _] of Object.entries(LOCATION_COORDINATES)) {
    if (locationLower.includes(key.toLowerCase()) || key.toLowerCase().includes(locationLower)) {
      return key;
    }
  }
  
  // Try to extract before comma
  const parts = location.split(',');
  if (parts.length > 0) {
    const firstPart = parts[0].trim();
    if (LOCATION_COORDINATES[firstPart]) {
      return firstPart;
    }
  }
  
  return null;
};

// Get coordinates for a location
const getCoordinates = (location: string | null): { lat: number; lng: number } | null => {
  const extracted = extractLocation(location);
  if (!extracted) return null;
  return LOCATION_COORDINATES[extracted] || null;
};

const LocationMap = ({ reels, selectedLanguage, selectedLocation }: LocationMapProps) => {
  const [viewState, setViewState] = useState({
    longitude: 77.2090, // Center of India (Delhi)
    latitude: 28.6139,
    zoom: 5,
  });
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{ [key: string]: Reel[] }>({});
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [languageLocations, setLanguageLocations] = useState<LanguageLocation[]>([]);

  // Get Mapbox token from environment
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXV4NTYyZ2gyM2x6bnE3N2ltb2QifQ.rJcFIG214AriISLbB6B5aw";
    setMapboxToken(token);
  }, []);

  // Fetch language-location mappings
  useEffect(() => {
    const fetchLanguageLocations = async () => {
      const { data, error } = await supabase
        .from("language_locations")
        .select("*");
      
      if (!error && data) {
        setLanguageLocations(data as LanguageLocation[]);
      }
    };
    
    fetchLanguageLocations();
  }, []);

  // Get locations for selected language
  const getLocationsForLanguage = useMemo(() => {
    if (!selectedLanguage || selectedLanguage === "All") {
      return null;
    }
    
    const langLocations = languageLocations.filter(ll => ll.language === selectedLanguage);
    const allCities: string[] = [];
    langLocations.forEach(ll => {
      allCities.push(...ll.cities);
      allCities.push(ll.state);
    });
    
    return allCities.map(c => c.toLowerCase());
  }, [selectedLanguage, languageLocations]);

  // Group reels by location and filter
  useEffect(() => {
    const filtered = reels.filter(reel => {
      // Filter by language
      if (selectedLanguage && selectedLanguage !== "All") {
        // If language is selected, show reels from locations where that language is most spoken
        if (getLocationsForLanguage) {
          const reelLocation = reel.locationname?.toLowerCase() || "";
          const matchesLanguageLocation = getLocationsForLanguage.some(loc => 
            reelLocation.includes(loc) || loc.includes(reelLocation)
          );
          
          // Also include reels that match the language directly
          if (!matchesLanguageLocation && reel.language !== selectedLanguage) {
            return false;
          }
        } else if (reel.language !== selectedLanguage) {
          return false;
        }
      }
      
      // Filter by location (if selectedLocation is provided)
      if (selectedLocation && reel.locationname && !reel.locationname.toLowerCase().includes(selectedLocation.toLowerCase())) {
        return false;
      }
      
      return reel.locationname && reel.locationname.trim().length > 0;
    });

    const grouped: { [key: string]: Reel[] } = {};
    filtered.forEach(reel => {
      const location = extractLocation(reel.locationname);
      if (location) {
        if (!grouped[location]) {
          grouped[location] = [];
        }
        grouped[location].push(reel);
      }
    });

    setLocationData(grouped);
  }, [reels, selectedLanguage, selectedLocation, getLocationsForLanguage]);

  // Calculate map center based on markers
  useEffect(() => {
    const locations = Object.keys(locationData);
    if (locations.length === 0) return;

    const coords = locations
      .map(loc => getCoordinates(loc))
      .filter((coord): coord is { lat: number; lng: number } => coord !== null);

    if (coords.length > 0) {
      const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
      const avgLng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;
      
      setViewState(prev => ({
        ...prev,
        latitude: avgLat,
        longitude: avgLng,
        zoom: coords.length === 1 ? 8 : 5,
      }));
    }
  }, [locationData]);

  const totalReels = Object.values(locationData).reduce((sum, reels) => sum + reels.length, 0);
  const totalViews = Object.values(locationData).reduce((sum, reels) => 
    sum + reels.reduce((s, r) => s + (r.videoplaycount || r.videoviewcount || 0), 0), 0
  );

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location Map</CardTitle>
          <CardDescription>Mapbox token not configured</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location-Based Reel Distribution</CardTitle>
        <CardDescription>
          {totalReels} reel(s) across {Object.keys(locationData).length} location(s)
          {selectedLanguage && selectedLanguage !== "All" && ` • Language: ${selectedLanguage}`}
          {selectedLocation && ` • Location: ${selectedLocation}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full relative rounded-lg overflow-hidden border">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={mapboxToken}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
          >
            {Object.entries(locationData).map(([location, locationReels]) => {
              const coords = getCoordinates(location);
              if (!coords) return null;

              const totalViews = locationReels.reduce((sum, r) => sum + (r.videoplaycount || r.videoviewcount || 0), 0);
              const totalLikes = locationReels.reduce((sum, r) => sum + (r.likescount || 0), 0);
              const totalComments = locationReels.reduce((sum, r) => sum + (r.commentscount || 0), 0);

              return (
                <Marker
                  key={location}
                  longitude={coords.lng}
                  latitude={coords.lat}
                  anchor="bottom"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => setSelectedMarker(selectedMarker === location ? null : location)}
                  >
                    <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:scale-110 transition-transform">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded whitespace-nowrap">
                      {locationReels.length}
                    </div>
                  </div>
                </Marker>
              );
            })}

            {selectedMarker && locationData[selectedMarker] && (
              <Popup
                longitude={getCoordinates(selectedMarker)!.lng}
                latitude={getCoordinates(selectedMarker)!.lat}
                anchor="bottom"
                onClose={() => setSelectedMarker(null)}
                closeButton={true}
                className="max-w-sm"
              >
                <div className="p-2">
                  <h3 className="font-semibold text-sm mb-2">{selectedMarker}</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{locationData[selectedMarker].length} reels</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{locationData[selectedMarker].reduce((sum, r) => sum + (r.videoplaycount || r.videoviewcount || 0), 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{locationData[selectedMarker].reduce((sum, r) => sum + (r.likescount || 0), 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>{locationData[selectedMarker].reduce((sum, r) => sum + (r.commentscount || 0), 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-semibold mb-1">Languages:</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(locationData[selectedMarker].map(r => r.language || "Hinglish"))).map(lang => (
                          <Badge key={lang} variant="outline" className="text-xs">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            )}
          </Map>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Locations</p>
            <p className="text-2xl font-bold">{Object.keys(locationData).length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Reels</p>
            <p className="text-2xl font-bold">{totalReels}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Views</p>
            <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationMap;

