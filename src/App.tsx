import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLayout from "@/components/AdminLayout";
import OverviewPage from "@/pages/admin/OverviewPage";
import AlertsPage from "@/pages/admin/AlertsPage";
import SessionsPage from "@/pages/admin/SessionsPage";
import AuditPage from "@/pages/admin/AuditPage";
import PermissionCatalogPage from "@/pages/admin/PermissionCatalogPage";
import RoleTemplatesPage from "@/pages/admin/RoleTemplatesPage";
import CleanerOnboardingPage from "@/pages/admin/CleanerOnboardingPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/overview" replace />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="overview" element={<OverviewPage />} />
            <Route path="security/alerts" element={<AlertsPage />} />
            <Route path="security/sessions" element={<SessionsPage />} />
            <Route path="security/audit" element={<AuditPage />} />
            <Route path="permissions/catalog" element={<PermissionCatalogPage />} />
            <Route path="permissions/templates" element={<RoleTemplatesPage />} />
            <Route path="onboarding/cleaners" element={<CleanerOnboardingPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
