import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import ImportVideo from "./pages/ImportVideo";
import NotFound from "./pages/NotFound";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <SignedIn>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/import-video" element={<ImportVideo />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SignedIn>
        <SignedOut>
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
