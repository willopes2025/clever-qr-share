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
const MetaAuthCallback = lazy(() => import("./pages/MetaAuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const Webhooks = lazy(() => import("./pages/Webhooks"));
const InternalChat = lazy(() => import("./pages/InternalChat"));
const Tasks = lazy(() => import("./pages/Tasks"));

interface AuthenticatedRouteProps {
  children: React.ReactNode;
  permission?: React.ComponentProps<typeof PermissionGate>["permission"];
}

const AuthenticatedRoute = ({ children, permission }: AuthenticatedRouteProps) => {
  const content = permission ? (
    <PermissionGate permission={permission}>{children}</PermissionGate>
  ) : (
    children
  );

  return (
    <ProtectedRoute>
      <SubscriptionProvider>
        <NotificationProvider>{content}</NotificationProvider>
      </SubscriptionProvider>
    </ProtectedRoute>
  );
};

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
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<AuthenticatedRoute permission="view_dashboard"><Dashboard /></AuthenticatedRoute>} />
                <Route path="/instances" element={<AuthenticatedRoute permission="view_instances"><Instances /></AuthenticatedRoute>} />
                <Route path="/inbox" element={<AuthenticatedRoute permission="view_inbox"><Inbox /></AuthenticatedRoute>} />
                <Route path="/campaigns" element={<AuthenticatedRoute permission="view_campaigns"><Campaigns /></AuthenticatedRoute>} />
                <Route path="/contacts" element={<AuthenticatedRoute permission="view_contacts"><Contacts /></AuthenticatedRoute>} />
                <Route path="/broadcast-lists" element={<AuthenticatedRoute permission="view_lists"><BroadcastLists /></AuthenticatedRoute>} />
                <Route path="/templates" element={<AuthenticatedRoute permission="view_templates"><Templates /></AuthenticatedRoute>} />
                <Route path="/settings" element={<AuthenticatedRoute><Settings /></AuthenticatedRoute>} />
                <Route path="/subscription" element={<AuthenticatedRoute permission="manage_subscription"><Subscription /></AuthenticatedRoute>} />
                <Route path="/admin" element={<AuthenticatedRoute><Admin /></AuthenticatedRoute>} />
                <Route path="/warming" element={<AuthenticatedRoute permission="view_warming"><Warming /></AuthenticatedRoute>} />
                <Route path="/analysis" element={<AuthenticatedRoute permission="view_analysis"><Analysis /></AuthenticatedRoute>} />
                <Route path="/funnels" element={<AuthenticatedRoute permission="view_funnels"><Funnels /></AuthenticatedRoute>} />
                <Route path="/calendar" element={<AuthenticatedRoute permission="view_calendar"><Calendar /></AuthenticatedRoute>} />
                <Route path="/lead-search" element={<AuthenticatedRoute permission="search_leads"><LeadSearch /></AuthenticatedRoute>} />
                <Route path="/instagram-scraper" element={<AuthenticatedRoute permission="search_leads"><InstagramScraper /></AuthenticatedRoute>} />
                <Route path="/chatbots" element={<AuthenticatedRoute permission="view_chatbots"><Chatbots /></AuthenticatedRoute>} />
                <Route path="/forms" element={<AuthenticatedRoute permission="view_forms"><Forms /></AuthenticatedRoute>} />
                <Route path="/forms/:id" element={<AuthenticatedRoute permission="view_forms"><FormBuilder /></AuthenticatedRoute>} />
                <Route path="/ai-agents" element={<AuthenticatedRoute permission="view_ai_agents"><AIAgents /></AuthenticatedRoute>} />
                <Route path="/financeiro" element={<AuthenticatedRoute permission="view_finances"><Financeiro /></AuthenticatedRoute>} />
                <Route path="/financeiro/devedores" element={<AuthenticatedRoute permission="view_finances"><DebtorsManagement /></AuthenticatedRoute>} />
                <Route path="/ssotica" element={<AuthenticatedRoute permission="view_ssotica"><Ssotica /></AuthenticatedRoute>} />
                  {/* Public pages for Meta compliance */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/data-deletion" element={<DataDeletion />} />
                <Route path="/data-deletion-callback" element={<DataDeletionCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/auth/meta/callback" element={<MetaAuthCallback />} />
                <Route path="/f/:slug/*" element={<PublicFormPage />} />
                <Route path="/form/:slug/*" element={<PublicFormPage />} />
                <Route path="/ajuda" element={<Ajuda />} />
                <Route path="/webhooks" element={<AuthenticatedRoute permission="manage_settings"><Webhooks /></AuthenticatedRoute>} />
                <Route path="/internal-chat" element={<AuthenticatedRoute><InternalChat /></AuthenticatedRoute>} />
                <Route path="/tasks" element={<AuthenticatedRoute><Tasks /></AuthenticatedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
