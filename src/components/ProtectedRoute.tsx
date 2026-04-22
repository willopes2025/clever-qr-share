import { useAuth } from '@/hooks/useAuth';
import { useIsSdr } from '@/hooks/useIsSdr';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isSdr, loading: sdrLoading } = useIsSdr();

  if (loading || sdrLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // SDRs only have access to /sdr - redirect them away from any other protected route
  if (isSdr) {
    return <Navigate to="/sdr" replace />;
  }

  return <>{children}</>;
};
