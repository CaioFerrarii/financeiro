import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompany";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Reports from "./pages/Reports";
import Import from "./pages/Import";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import Spreadsheet from "./pages/Spreadsheet";
import Alerts from "./pages/Alerts";
import SystemStatus from "./pages/SystemStatus";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import TeamPage from "./pages/team";
import AcceptInvite from "./pages/AcceptInvite";
const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/export" element={<Export />} />
                  <Route path="/spreadsheet" element={<Spreadsheet />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/system-status" element={<SystemStatus />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />
                </Route>
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
