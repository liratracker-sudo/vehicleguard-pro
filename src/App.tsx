import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WhatsAppProvider } from "@/contexts/WhatsAppContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import AdminPage from "./pages/Admin";
import ClientsPage from "./pages/Clients";
import PlansPage from "./pages/Plans";
import ContractsPage from "./pages/Contracts";
import VehiclesPage from "./pages/Vehicles";
import BillingPage from "./pages/Billing";
import FinancialPage from "./pages/Financial";
import ReportsPage from "./pages/Reports";
import WhiteLabelPage from "./pages/WhiteLabel";
import SettingsPage from "./pages/Settings";
import BillingDiagnosticsPage from "./pages/BillingDiagnostics";
import ExpensesPage from "./pages/Expenses";
import NotFound from "./pages/NotFound";
import CheckoutPage from "./pages/Checkout";
import PublicClientRegistration from "./pages/PublicClientRegistration";
import ClientRegistrations from "./pages/ClientRegistrations";
import ProfilePage from "./pages/Profile";
import AIDemo from "./pages/AIDemo";
import LandingPage from "./pages/LandingPage";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AuthGuard } from "@/components/auth/AuthGuard";

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
        <ThemeProvider>
          <WhatsAppProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/demo" element={<AIDemo />} />
              <Route path="/checkout/:payment_id" element={<CheckoutPage />} />
              <Route path="/payment/:payment_id" element={<CheckoutPage />} />
              <Route path="/cadastro/:company_slug" element={<PublicClientRegistration />} />
              <Route path="/dashboard" element={<AuthGuard><Index /></AuthGuard>} />
              <Route path="/admin" element={<AuthGuard><RoleGuard allowed={['super_admin']}><AdminPage /></RoleGuard></AuthGuard>} />
              <Route path="/clients" element={<AuthGuard><ClientsPage /></AuthGuard>} />
              <Route path="/registrations" element={<AuthGuard><ClientRegistrations /></AuthGuard>} />
              <Route path="/plans" element={<AuthGuard><PlansPage /></AuthGuard>} />
              <Route path="/contracts" element={<AuthGuard><ContractsPage /></AuthGuard>} />
              <Route path="/vehicles" element={<AuthGuard><VehiclesPage /></AuthGuard>} />
              <Route path="/billing" element={<AuthGuard><BillingPage /></AuthGuard>} />
              <Route path="/financial" element={<AuthGuard><FinancialPage /></AuthGuard>} />
              <Route path="/expenses" element={<AuthGuard><ExpensesPage /></AuthGuard>} />
              <Route path="/reports" element={<AuthGuard><ReportsPage /></AuthGuard>} />
              <Route path="/white-label" element={<AuthGuard><WhiteLabelPage /></AuthGuard>} />
              <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
              <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
              <Route path="/billing-diagnostics" element={<AuthGuard><BillingDiagnosticsPage /></AuthGuard>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </WhatsAppProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
