import { useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Skeleton } from "@/components/ui/skeleton";

// Only eagerly load the most critical routes
import AuthPage from "./pages/Auth";
import LandingPage from "./pages/LandingPage";

// Lazy load all other pages
const Index = lazy(() => import("./pages/Index"));
const AdminPage = lazy(() => import("./pages/Admin"));
const ClientsPage = lazy(() => import("./pages/Clients"));
const PlansPage = lazy(() => import("./pages/Plans"));
const ContractsPage = lazy(() => import("./pages/Contracts"));
const VehiclesPage = lazy(() => import("./pages/Vehicles"));
const BillingPage = lazy(() => import("./pages/Billing"));
const FinancialPage = lazy(() => import("./pages/Financial"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const WhiteLabelPage = lazy(() => import("./pages/WhiteLabel"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const BillingDiagnosticsPage = lazy(() => import("./pages/BillingDiagnostics"));
const ExpensesPage = lazy(() => import("./pages/Expenses"));
const CheckoutPage = lazy(() => import("./pages/Checkout"));
const PublicClientRegistration = lazy(() => import("./pages/PublicClientRegistration"));
const ClientRegistrations = lazy(() => import("./pages/ClientRegistrations"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const AIDemo = lazy(() => import("./pages/AIDemo"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocs"));
const PublicApiDocs = lazy(() => import("./pages/PublicApiDocs"));
const SellersPage = lazy(() => import("./pages/Sellers"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lightweight page loading skeleton
const PageSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="space-y-4 w-full max-w-md p-8">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  </div>
);

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/demo" element={<AIDemo />} />
                <Route path="/docs/api" element={<PublicApiDocs />} />
                <Route path="/checkout/:payment_id" element={<CheckoutPage />} />
                <Route path="/payment/:payment_id" element={<CheckoutPage />} />
                <Route path="/cadastro/:company_slug" element={<PublicClientRegistration />} />
                <Route path="/dashboard" element={<AuthGuard><Index /></AuthGuard>} />
                <Route path="/admin" element={<AuthGuard><RoleGuard allowed={['super_admin']}><AdminPage /></RoleGuard></AuthGuard>} />
                <Route path="/clients" element={<AuthGuard><ClientsPage /></AuthGuard>} />
                <Route path="/registrations" element={<AuthGuard><ClientRegistrations /></AuthGuard>} />
                <Route path="/sellers" element={<AuthGuard><SellersPage /></AuthGuard>} />
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
                <Route path="/api-docs" element={<AuthGuard><ApiDocsPage /></AuthGuard>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
