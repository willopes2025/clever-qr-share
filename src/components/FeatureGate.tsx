import { ReactNode } from 'react';
import { useSubscription, PLANS, hasFeatureAccess } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureGate = ({ feature, children, fallback }: FeatureGateProps) => {
  const { subscription, loading } = useSubscription();
  const navigate = useNavigate();
  const plan = subscription?.plan || 'free';
  const hasAccess = hasFeatureAccess(plan, feature);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-primary/10 p-4 rounded-full mb-6">
          <Lock className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Recurso Premium</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Este recurso está disponível em planos superiores.
          Faça upgrade para desbloquear todas as funcionalidades.
        </p>
        <Button size="lg" onClick={() => navigate('/subscription')}>
          <Sparkles className="mr-2 h-4 w-4" />
          Fazer Upgrade
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
