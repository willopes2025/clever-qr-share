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
import { TimezoneBootstrap } from "@/components/TimezoneBootstrap";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";


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
const DynamicReports = lazy(() => import("./pages/DynamicReports"));
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
const MetaAuthCallback = lazy(() => import("./pages/MetaAuthCallback"));
const MetaMessengerCallback = lazy(() => import("./pages/MetaMessengerCallback"));
const Email = lazy(() => import("./pages/Email"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const Treinamentos = lazy(() => import("./pages/Treinamentos"));
const Webhooks = lazy(() => import("./pages/Webhooks"));
const InternalChat = lazy(() => import("./pages/InternalChat"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const ShortLinkRedirect = lazy(() => import("./pages/ShortLinkRedirect"));

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
          <TimezoneBootstrap />
          <WhatsNewDialog />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              {/* NotificationProvider hoisted above Routes: one Realtime channel
                  for the whole app instead of one per route. It internally
                  guards on the authenticated user, so public routes stay cheap. */}
              <NotificationProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_dashboard">
                          <Dashboard />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/instances" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_instances">
                          <Instances />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/inbox" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_inbox">
                          <Inbox />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/campaigns" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_campaigns">
                          <Campaigns />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/contacts" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_contacts">
                          <Contacts />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/broadcast-lists" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_lists">
                          <BroadcastLists />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/templates" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_templates">
                          <Templates />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    } />
                    <Route path="/subscription" element={
                      <ProtectedRoute>
                        <PermissionGate permission="manage_subscription">
                          <Subscription />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                      <ProtectedRoute>
                        <Admin />
                      </ProtectedRoute>
                    } />
                    <Route path="/warming" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_warming">
                          <Warming />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/analysis" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_analysis">
                          <Analysis />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/relatorios-dinamicos" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_dynamic_reports">
                          <DynamicReports />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/funnels" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_funnels">
                          <Funnels />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/calendar" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_calendar">
                          <Calendar />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/lead-search" element={
                      <ProtectedRoute>
                        <PermissionGate permission="search_leads">
                          <LeadSearch />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/instagram-scraper" element={
                      <ProtectedRoute>
                        <PermissionGate permission="search_leads">
                          <InstagramScraper />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/chatbots" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_chatbots">
                          <Chatbots />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/forms" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_forms">
                          <Forms />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/forms/:id" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_forms">
                          <FormBuilder />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/ai-agents" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_ai_agents">
                          <AIAgents />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/financeiro" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_finances">
                          <Financeiro />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/financeiro/devedores" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_finances">
                          <DebtorsManagement />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/ssotica" element={
                      <ProtectedRoute>
                        <PermissionGate permission="view_ssotica">
                          <Ssotica />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    {/* Public pages for Meta compliance */}
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/data-deletion-callback" element={<DataDeletionCallback />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/auth/meta/callback" element={<MetaAuthCallback />} />
                    <Route path="/auth/meta-social/callback" element={<MetaMessengerCallback />} />
                    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                    <Route path="/s/:code" element={<ShortLinkRedirect />} />
                    <Route path="/f/:slug/*" element={<PublicFormPage />} />
                    <Route path="/form/:slug/*" element={<PublicFormPage />} />
                    <Route path="/ajuda" element={<Ajuda />} />
                    <Route path="/treinamentos" element={
                      <ProtectedRoute>
                        <Treinamentos />
                      </ProtectedRoute>
                    } />
                    <Route path="/webhooks" element={
                      <ProtectedRoute>
                        <PermissionGate permission="manage_settings">
                          <Webhooks />
                        </PermissionGate>
                      </ProtectedRoute>
                    } />
                    <Route path="/internal-chat" element={
                      <ProtectedRoute>
                        <InternalChat />
                      </ProtectedRoute>
                    } />
                    <Route path="/tasks" element={
                      <ProtectedRoute>
                        <Tasks />
                      </ProtectedRoute>
                    } />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </NotificationProvider>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
