import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import ClientsPage from "./pages/Clients";
import PlansPage from "./pages/Plans";
import ContractsPage from "./pages/Contracts";
import VehiclesPage from "./pages/Vehicles";
import BillingPage from "./pages/Billing";
import FinancialPage from "./pages/Financial";
import ReportsPage from "./pages/Reports";
import WhiteLabelPage from "./pages/WhiteLabel";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const App = () => {
  // Create QueryClient inside component to ensure React is available
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/financial" element={<FinancialPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/white-label" element={<WhiteLabelPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
