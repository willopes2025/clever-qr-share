import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PermissionGate } from "@/components/PermissionGate";
import { NotificationProvider } from "@/components/NotificationProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Instances from "./pages/Instances";
import Campaigns from "./pages/Campaigns";
import Contacts from "./pages/Contacts";
import BroadcastLists from "./pages/BroadcastLists";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import Admin from "./pages/Admin";
import Inbox from "./pages/Inbox";
import Warming from "./pages/Warming";
import Analysis from "./pages/Analysis";
import Funnels from "./pages/Funnels";
import LeadSearch from "./pages/LeadSearch";
import Calendar from "./pages/Calendar";
import Chatbots from "./pages/Chatbots";
import AIAgents from "./pages/AIAgents";
import Financeiro from "./pages/Financeiro";
import DebtorsManagement from "./pages/DebtorsManagement";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataDeletion from "./pages/DataDeletion";
import DataDeletionCallback from "./pages/DataDeletionCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent refetching on window focus which can cause UI flicker
      refetchOnWindowFocus: false,
      // Retry failed requests up to 1 time
      retry: 1,
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_dashboard">
                    <Dashboard />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/instances" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_instances">
                    <Instances />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/inbox" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_inbox">
                    <Inbox />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/campaigns" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_campaigns">
                    <Campaigns />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/contacts" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_contacts">
                    <Contacts />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/broadcast-lists" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_lists">
                    <BroadcastLists />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/templates" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_templates">
                    <Templates />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <Settings />
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/subscription" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="manage_subscription">
                    <Subscription />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <Admin />
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/warming" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_warming">
                    <Warming />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/analysis" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_analysis">
                    <Analysis />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/funnels" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_funnels">
                    <Funnels />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/calendar" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_calendar">
                    <Calendar />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/lead-search" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="search_leads">
                    <LeadSearch />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/chatbots" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_chatbots">
                    <Chatbots />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/ai-agents" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_ai_agents">
                    <AIAgents />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/financeiro" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_finances">
                    <Financeiro />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            <Route path="/financeiro/devedores" element={
              <ProtectedRoute>
                <NotificationProvider>
                  <PermissionGate permission="view_finances">
                    <DebtorsManagement />
                  </PermissionGate>
                </NotificationProvider>
              </ProtectedRoute>
            } />
            {/* Public pages for Meta compliance */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/data-deletion-callback" element={<DataDeletionCallback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
