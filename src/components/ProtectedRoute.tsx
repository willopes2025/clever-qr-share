import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const { isAccountActive, loading: subLoading } = useSubscriptionContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!subLoading && !isAccountActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4 border border-border rounded-xl p-8 bg-card">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Conta suspensa</h1>
          <p className="text-muted-foreground">
            Sua conta está inativa. Regularize a assinatura com o administrador para voltar a
            usar o sistema. Formulários e envios permanecem desativados até a reativação.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Sair do sistema
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
