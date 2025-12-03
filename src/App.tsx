import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import ImportReel from "./pages/ImportReel";
import NotFound from "./pages/NotFound";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SignedIn>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/import-reel" element={<ImportReel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SignedIn>
        <SignedOut>
          {/* You can still keep /auth route if you want a custom landing, but Clerk will handle sign-in */}
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<RedirectToSignIn />} />
          </Routes>
        </SignedOut>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
