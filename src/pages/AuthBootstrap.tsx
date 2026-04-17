import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/hooks/useAuth";

const AuthBootstrap = () => {
  const navigate = useNavigate();
  const { authReady, loading, user, session, isAuthenticatedStable } = useAuth();

  useEffect(() => {
    console.log('[AuthBootstrap] state:', {
      authReady,
      loading,
      hasUser: !!user,
      hasToken: !!session?.access_token,
      isAuthenticatedStable,
    });

    if (!authReady || loading || !isAuthenticatedStable) {
      return;
    }

    const timeout = window.setTimeout(() => {
      console.log('[AuthBootstrap] bootstrap ok -> /instances');
      navigate('/instances', { replace: true });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [authReady, loading, user, session?.access_token, isAuthenticatedStable, navigate]);

  if (!authReady || loading) {
    return <PageLoader />;
  }

  if (!user || !session?.access_token) {
    return <Navigate to="/login" replace />;
  }

  return <PageLoader />;
};

export default AuthBootstrap;