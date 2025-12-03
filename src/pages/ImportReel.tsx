import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Link as LinkIcon, FileText, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { transformApifyToReel, saveReelsToSupabase, fetchReelFromApify, fetchReelsFromApify } from "@/lib/apify";
import { fetchFromInternalApi, transformInternalApiToReel } from "@/lib/internalApi";
import { getApiProvider } from "@/lib/apiProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUser } from "@clerk/clerk-react";

const ImportReel = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>("");
  
  // Single reel import
  const [singleReelUrl, setSingleReelUrl] = useState("");
  const [importingSingle, setImportingSingle] = useState(false);
  
  // Bulk import
  const [bulkUrls, setBulkUrls] = useState("");
  const [importingBulk, setImportingBulk] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(false);
  }, [isLoaded, user, navigate]);

  const handleImportSingleReel = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!singleReelUrl.trim()) {
      toast.error("Please enter a reel URL");
      return;
    }

    setImportingSingle(true);
    try {
      // Validate URL format
      if (!singleReelUrl.includes("instagram.com")) {
        toast.error("Please enter a valid Instagram URL");
        setImportingSingle(false);
        return;
      }

      const apiProvider = getApiProvider();
      console.log(`📡 Using ${apiProvider} API for import`);

      let transformedReel;

      if (apiProvider === 'internal') {
        // Use Internal API
        toast.info("Importing reel using Internal API...");
        
        try {
          const internalData = await fetchFromInternalApi(singleReelUrl, 1); // Priority 1 for imports
          
          if (!internalData) {
            toast.error("No data returned from Internal API. Please check the URL.");
            setImportingSingle(false);
            return;
          }
          
          transformedReel = transformInternalApiToReel(internalData, singleReelUrl);
          console.log("Internal API transformed reel:", transformedReel);
        } catch (internalError: any) {
          console.error("Internal API error:", internalError);
          toast.error(`Internal API error: ${internalError.message}`);
          setImportingSingle(false);
          return;
        }
      } else {
        // Use External API (Apify)
        const keyToUse = apiKey.trim() || undefined;
        toast.info("Importing reel using Apify. This may take a few moments...");
        
        const items = await fetchReelFromApify(singleReelUrl, keyToUse);
        console.log("Apify returned items:", items);
        
        if (!items || items.length === 0) {
          toast.error("No data returned from Apify. Please check: 1) The URL is correct, 2) Your API key is valid, 3) The reel is publicly accessible.");
          setImportingSingle(false);
          return;
        }

        // Check if all items are error responses
        const errorItems = items.filter(item => item.error || item.errorDescription);
        const validItems = items.filter(item => !item.error && !item.errorDescription);
        
        if (validItems.length === 0 && errorItems.length > 0) {
          const errorMsg = errorItems[0]?.errorDescription || errorItems[0]?.error || "Unknown error";
          console.error("All items are error responses:", errorItems);
          toast.error(`Reel not accessible: ${errorMsg}. The reel might be private, deleted, or the actor failed to fetch it.`);
          setImportingSingle(false);
          return;
        }
        
        const itemsToProcess = validItems.length > 0 ? validItems : items;
        const reelData = itemsToProcess[0];
        console.log("Found reel data:", reelData);
        transformedReel = transformApifyToReel(reelData);
        console.log("Transformed reel:", transformedReel);
      }
      
      // Validate transformed reel has required fields
      if (!transformedReel.permalink && !transformedReel.url && !transformedReel.shortcode) {
        toast.error("Invalid reel data: missing identifier. Please check the URL.");
        setImportingSingle(false);
        return;
      }
      
      const userInfo = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: user.fullName || "User",
      };
      const result = await saveReelsToSupabase([transformedReel], userInfo);
      console.log("Save result:", result);
      
      if (result.errors === 0) {
        toast.success("Reel imported successfully!");
        setSingleReelUrl("");
      } else {
        const errorMsg = result.errorDetails?.[0] || `Failed to save reel to database`;
        console.error("Import errors:", result.errorDetails);
        toast.error(`Failed to import reel: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error("Single reel import error:", error);
      console.error("Error stack:", error?.stack);
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      toast.error(`Failed to import reel: ${errorMessage}`);
    } finally {
      setImportingSingle(false);
    }
  };

  const handleImportBulk = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!bulkUrls.trim()) {
      toast.error("Please enter reel URLs");
      return;
    }

    setImportingBulk(true);
    try {
      const urls = bulkUrls
        .split("\n")
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      if (urls.length === 0) {
        toast.error("Please enter at least one reel URL");
        setImportingBulk(false);
        return;
      }

      const apiProvider = getApiProvider();
      console.log(`📡 Using ${apiProvider} API for bulk import of ${urls.length} URLs`);

      const userInfo = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        fullName: user.fullName || "User",
      };

      if (apiProvider === 'internal') {
        // Use Internal API - import one by one with rate limiting
        toast.info(`Importing ${urls.length} reel(s) using Internal API. This may take a while due to rate limiting...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          try {
            toast.info(`Importing reel ${i + 1}/${urls.length}...`);
            
            const internalData = await fetchFromInternalApi(url, 1); // Priority 1 for imports
            
            if (internalData) {
              const transformedReel = transformInternalApiToReel(internalData, url);
              const result = await saveReelsToSupabase([transformedReel], userInfo);
              
              if (result.errors === 0) {
                successCount++;
              } else {
                errorCount++;
                console.error(`Error saving reel ${url}:`, result.errorDetails);
              }
            } else {
              errorCount++;
              console.error(`No data returned for ${url}`);
            }
          } catch (err: any) {
            errorCount++;
            console.error(`Error importing ${url}:`, err);
          }
        }
        
        if (errorCount === 0) {
          toast.success(`Successfully imported ${successCount} reel(s)!`);
          setBulkUrls("");
        } else if (successCount > 0) {
          toast.warning(`Imported ${successCount} reel(s), ${errorCount} error(s)`);
        } else {
          toast.error("Failed to import reels");
        }
      } else {
        // Use External API (Apify)
        const keyToUse = apiKey.trim() || undefined;
        
        toast.info(`Triggering Apify actor run for ${urls.length} URL(s). This may take a few moments...`);
        const items = await fetchReelsFromApify(urls, keyToUse);
        
        if (!items || items.length === 0) {
          toast.error("No data returned from Apify. Please check the URLs and try again.");
          setImportingBulk(false);
          return;
        }
        
        // Match URLs with returned items
        const transformedReels = urls
          .map(url => {
            const matchingReel = items.find((item: any) => 
              item.url?.includes(url) || 
              item.inputUrl?.includes(url) ||
              url.includes(item.shortCode || "") ||
              item.url?.includes(url.split('/').pop() || "")
            );
            return matchingReel ? transformApifyToReel(matchingReel) : null;
          })
          .filter((reel): reel is NonNullable<typeof reel> => reel !== null);
        
        if (transformedReels.length === 0) {
          toast.error("No matching reels found in Apify response");
          setImportingBulk(false);
          return;
        }
        
        const result = await saveReelsToSupabase(transformedReels, userInfo);
        
        if (result.errors === 0) {
          toast.success(`Successfully imported ${result.success} reel(s)!`);
          setBulkUrls("");
        } else if (result.success > 0) {
          toast.warning(`Imported ${result.success} reel(s), ${result.errors} error(s)`);
        } else {
          toast.error("Failed to import reels");
        }
      }
    } catch (error: any) {
      console.error("Bulk import error:", error);
      toast.error(error.message || "Failed to import reels. Please try again.");
    } finally {
      setImportingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentProvider = getApiProvider();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-instagram bg-clip-text text-transparent">
            Import Reels
          </h1>
          <p className="text-muted-foreground mt-1">
            Import Instagram reels by single URL or bulk import
          </p>
          <p className="text-sm text-primary mt-2">
            Currently using: <strong>{currentProvider === 'internal' ? 'Internal API' : 'External API (Apify)'}</strong>
            {currentProvider === 'internal' && ' (Rate limited: ~20 requests per 5 minutes)'}
          </p>
        </div>

        {currentProvider === 'external' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Apify API Key</CardTitle>
              <CardDescription>
                Enter your Apify API key. If left empty, the default key will be used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Apify API token"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {apiKey ? "Using your custom API key" : "Using default API key from environment"}
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-300">
                        <span className="font-semibold">Important:</span> This is a free API that fetches Instagram data. The API token may expire periodically. Click here to learn how to get your own API token.
                      </p>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>How to Get Your Apify API Token</DialogTitle>
                      <DialogDescription>
                        Follow these steps to obtain your free Apify API token
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                        <p className="text-blue-900 dark:text-blue-100">
                          <strong>Note:</strong> This is a free API service that fetches Instagram reel data. However, the API token may expire from time to time. To ensure uninterrupted access, you can get your own free API token by following the steps below.
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                            1
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-1">Visit the Apify Console</p>
                            <p className="text-muted-foreground mb-2">
                              Go to the following link and register/login to your Apify account:
                            </p>
                            <a
                              href="https://console.apify.com/actors/shu8hvrXbJbY3Eb9W/runs/Cv6NRD7kIDtDNZHf2#output"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Open Apify Console
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                            2
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-1">Click on the "API" Button</p>
                            <p className="text-muted-foreground">
                              Once you're logged in, look for the <strong>"API"</strong> button in the top navigation bar and click on it.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                            3
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-1">Copy Your API Token</p>
                            <p className="text-muted-foreground mb-2">
                              In the API section, you'll see an "API token" dropdown field. Click on the copy button (two overlapping rectangles icon) next to the token field to copy your API token.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                            4
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-1">Paste and Save</p>
                            <p className="text-muted-foreground">
                              Paste the copied API token into the "API Key" field above and click the <strong>"Save"</strong> button to store it.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-yellow-900 dark:text-yellow-100 text-xs">
                          <strong>Tip:</strong> If you don't have an Apify account, you can create one for free. The default API key will work initially, but getting your own token ensures better reliability.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {currentProvider === 'internal' && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Using Internal API</CardTitle>
              <CardDescription>
                Your custom scraper API is being used. Rate limited to ~20 requests per 5 minutes.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <LinkIcon className="h-4 w-4 mr-2" />
              Single Reel
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <FileText className="h-4 w-4 mr-2" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Single Reel</CardTitle>
                <CardDescription>
                  Enter a single Instagram reel URL to import
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="single-url">Reel URL</Label>
                  <Input
                    id="single-url"
                    type="url"
                    placeholder="https://www.instagram.com/reel/ABC123/"
                    value={singleReelUrl}
                    onChange={(e) => setSingleReelUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleImportSingleReel}
                  disabled={importingSingle || !singleReelUrl.trim()}
                  className="bg-gradient-instagram w-full"
                  size="lg"
                >
                  {importingSingle ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Reel
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Import Reels</CardTitle>
                <CardDescription>
                  Enter multiple reel URLs, one per line
                  {currentProvider === 'internal' && (
                    <span className="text-yellow-600 dark:text-yellow-400 block mt-1">
                      ⚠️ Note: With Internal API, bulk imports are processed one at a time with rate limiting.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-urls">Reel URLs (one per line)</Label>
                  <Textarea
                    id="bulk-urls"
                    placeholder={`https://www.instagram.com/reel/ABC123/
https://www.instagram.com/reel/XYZ789/
https://www.instagram.com/reel/DEF456/`}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {bulkUrls.split("\n").filter(l => l.trim()).length} URL(s) entered
                  </p>
                </div>
                <Button
                  onClick={handleImportBulk}
                  disabled={importingBulk || !bulkUrls.trim()}
                  className="bg-gradient-instagram w-full"
                  size="lg"
                >
                  {importingBulk ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import All Reels
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ImportReel;
