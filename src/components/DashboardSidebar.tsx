import { NavLink, useNavigate } from "react-router-dom";
import { Zap, LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut, CreditCard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription, PLANS } from "@/hooks/useSubscription";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: QrCode, label: "Instâncias", path: "/instances" },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: List, label: "Listas", path: "/broadcast-lists" },
  { icon: FileText, label: "Templates", path: "/templates" },
  { icon: Send, label: "Disparos", path: "/campaigns" },
  { icon: CreditCard, label: "Assinatura", path: "/subscription" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { currentPlan, isSubscribed } = useSubscription();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair: " + error.message);
    } else {
      toast.success("Logout realizado com sucesso");
      navigate("/login");
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col glass-card">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="relative h-10 w-10 rounded-lg bg-gradient-neon flex items-center justify-center shadow-glow-cyan">
          <Zap className="h-6 w-6 text-background" />
          <div className="absolute inset-0 rounded-lg bg-gradient-neon opacity-50 blur-sm" />
        </div>
        <span className="text-xl font-display font-bold tracking-wider text-primary text-glow-cyan">
          WIDEZAP
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-primary/20 text-primary shadow-glow-cyan neon-border"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-primary hover:shadow-soft"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        
        {/* Admin Link - só visível para admins */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-yellow-500/20 text-yellow-400 shadow-glow-cyan neon-border"
                  : "text-yellow-400/70 hover:bg-yellow-500/10 hover:text-yellow-400 hover:shadow-soft"
              )
            }
          >
            <Shield className="h-5 w-5" />
            Admin
          </NavLink>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <NavLink to="/subscription" className="block">
          <div className="bg-gradient-cyber rounded-lg p-4 neon-border hover:shadow-glow-cyan transition-all cursor-pointer">
            <p className="text-xs text-muted-foreground mb-1">Plano Ativo</p>
            <p className="text-sm font-display font-bold text-primary text-glow-cyan">
              {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
            </p>
          </div>
        </NavLink>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Sair do Sistema
        </Button>
      </div>
    </aside>
  );
};
