import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PermissionGateProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGate = ({ permission, children, fallback }: PermissionGateProps) => {
  const navigate = useNavigate();
  const { checkPermission, isLoading, organization } = useOrganization();

  // Enquanto carrega, mostrar loading
  if (isLoading) {
    return (
      <DashboardLayout className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </DashboardLayout>
    );
  }

  // Se não tem organização, permite acesso (usuário individual, legado)
  // Mas se tem organização e não tem permissão, bloqueia
  const hasAccess = !organization || checkPermission(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Fallback customizado ou padrão
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <DashboardLayout className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md p-8 bg-card/50 rounded-2xl border border-border/50">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-6">
          Você não tem permissão para acessar esta página. Entre em contato com o administrador da sua organização.
        </p>
        <Button onClick={() => navigate("/dashboard")} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    </DashboardLayout>
  );
};
