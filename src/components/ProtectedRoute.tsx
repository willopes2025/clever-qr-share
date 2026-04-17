import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, session, loading, authReady } = useAuth();

  // Wait for auth to be fully ready before deciding anything
  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Auth is ready: if no user OR no session token, redirect to login
  if (!user || !session?.access_token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
