import { Navigate } from "react-router-dom";
import { useIsSdr } from "@/hooks/useIsSdr";
import { useAuth } from "@/hooks/useAuth";

interface SdrRouteProps {
  children: React.ReactNode;
}

export const SdrRoute = ({ children }: SdrRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSdr, loading } = useIsSdr();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSdr) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
