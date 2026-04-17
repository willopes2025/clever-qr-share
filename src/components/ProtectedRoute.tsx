import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { PageLoader } from '@/components/PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, session, loading, authReady, isAuthenticatedStable } = useAuth();

  // Wait for auth to be fully ready before deciding anything
  if (!authReady || loading) {
    return <PageLoader />;
  }

  // Auth is ready: if no user OR no session token, redirect to login
  if (!user || !session?.access_token) {
    console.log('[ProtectedRoute] blocked: missing user or token');
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticatedStable) {
    console.log('[ProtectedRoute] waiting for stable auth');
    return <PageLoader />;
  }

  console.log('[ProtectedRoute] released');

  return <>{children}</>;
};
