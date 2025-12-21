import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut, CreditCard, Shield, MessageSquare, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import wideLogo from "@/assets/wide-logo.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: QrCode, label: "Instâncias", path: "/instances" },
  { icon: Flame, label: "Aquecimento", path: "/warming" },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", showBadge: true },
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
  const { conversations } = useConversations();
  
  // Calculate total unread messages
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

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
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col shadow-elevated">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/30">
        <img src={wideLogo} alt="Widezap" className="h-10 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.label}</span>
            {item.showBadge && totalUnread > 0 && (
              <Badge 
                variant="destructive" 
                className="h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </NavLink>
        ))}
        
        {/* Admin Link */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
              )
            }
          >
            <Shield className="h-5 w-5" />
            Admin
          </NavLink>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border/30 space-y-3">
        <NavLink to="/subscription" className="block">
          <div className="bg-sidebar-accent/50 rounded-xl p-4 hover:bg-sidebar-accent transition-colors cursor-pointer">
            <p className="text-xs text-sidebar-foreground/60 mb-1">Plano Ativo</p>
            <p className="text-sm font-semibold text-sidebar-primary">
              {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
            </p>
          </div>
        </NavLink>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
        >
          <LogOut className="h-5 w-5" />
          Sair do Sistema
        </Button>
      </div>
    </aside>
  );
};
