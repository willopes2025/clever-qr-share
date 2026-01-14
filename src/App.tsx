import { lazy, Suspense } from "react";
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
import { PageLoader } from "@/components/PageLoader";


// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Instances = lazy(() => import("./pages/Instances"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Contacts = lazy(() => import("./pages/Contacts"));
const BroadcastLists = lazy(() => import("./pages/BroadcastLists"));
const Templates = lazy(() => import("./pages/Templates"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Admin = lazy(() => import("./pages/Admin"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Warming = lazy(() => import("./pages/Warming"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Funnels = lazy(() => import("./pages/Funnels"));
const LeadSearch = lazy(() => import("./pages/LeadSearch"));
const InstagramScraper = lazy(() => import("./pages/InstagramScraper"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Chatbots = lazy(() => import("./pages/Chatbots"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const DebtorsManagement = lazy(() => import("./pages/DebtorsManagement"));
const Ssotica = lazy(() => import("./pages/Ssotica"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const DataDeletion = lazy(() => import("./pages/DataDeletion"));
const DataDeletionCallback = lazy(() => import("./pages/DataDeletionCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));
const Ajuda = lazy(() => import("./pages/Ajuda"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // Garbage collect after 10 minutes
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
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/instagram-scraper" element={
                    <ProtectedRoute>
                      <NotificationProvider>
                        <PermissionGate permission="search_leads">
                          <InstagramScraper />
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
                  <Route path="/forms" element={
                    <ProtectedRoute>
                      <NotificationProvider>
                        <PermissionGate permission="view_forms">
                          <Forms />
                        </PermissionGate>
                      </NotificationProvider>
                    </ProtectedRoute>
                  } />
                  <Route path="/forms/:id" element={
                    <ProtectedRoute>
                      <NotificationProvider>
                        <PermissionGate permission="view_forms">
                          <FormBuilder />
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
                  <Route path="/ssotica" element={
                    <ProtectedRoute>
                      <NotificationProvider>
                        <PermissionGate permission="view_ssotica">
                          <Ssotica />
                        </PermissionGate>
                      </NotificationProvider>
                    </ProtectedRoute>
                  } />
                  {/* Public pages for Meta compliance */}
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/data-deletion" element={<DataDeletion />} />
                  <Route path="/data-deletion-callback" element={<DataDeletionCallback />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/f/:slug" element={<PublicFormPage />} />
                  <Route path="/form/:slug/*" element={<PublicFormPage />} />
                  <Route path="/ajuda" element={<Ajuda />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
