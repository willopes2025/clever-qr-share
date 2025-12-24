import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NotificationProvider } from "@/components/NotificationProvider";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
                <Dashboard />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/instances" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Instances />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/inbox" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Inbox />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/campaigns" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Campaigns />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/contacts" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Contacts />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/broadcast-lists" element={
            <ProtectedRoute>
              <NotificationProvider>
                <BroadcastLists />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/templates" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Templates />
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
                <Subscription />
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
                <Warming />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/analysis" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Analysis />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          <Route path="/funnels" element={
            <ProtectedRoute>
              <NotificationProvider>
                <Funnels />
              </NotificationProvider>
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
