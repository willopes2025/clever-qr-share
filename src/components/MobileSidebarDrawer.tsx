import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut, CreditCard, Shield, MessageSquare, Flame, BarChart3, Target, Building2, CalendarDays, X, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription, PLANS, hasFeatureAccess } from "@/hooks/useSubscription";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { useSidebarContext } from "@/contexts/SidebarContext";
import wideLogo from "@/assets/wide-logo.png";
import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  permission?: PermissionKey;
  showBadge?: boolean;
  premiumOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permission: "view_dashboard" },
    ],
  },
  {
    label: "Potencialize seu WhatsApp",
    items: [
      { icon: QrCode, label: "Instâncias", path: "/instances", permission: "view_instances" },
      { icon: Flame, label: "Aquecimento", path: "/warming", permission: "view_warming" },
    ],
  },
  {
    label: "Atendimento e Vendas",
    items: [
      { icon: MessageSquare, label: "Inbox", path: "/inbox", permission: "view_inbox", showBadge: true },
      { icon: Target, label: "Funis", path: "/funnels", permission: "view_funnels" },
      { icon: CalendarDays, label: "Calendário", path: "/calendar", permission: "view_calendar" },
      { icon: BarChart3, label: "Análise", path: "/analysis", permission: "view_analysis", premiumOnly: true },
    ],
  },
  {
    label: "Organize seus Clientes",
    items: [
      { icon: Users, label: "Contatos", path: "/contacts", permission: "view_contacts" },
      { icon: Building2, label: "Pesquisa de Leads", path: "/lead-search", permission: "search_leads" },
      { icon: List, label: "Listas", path: "/broadcast-lists", permission: "view_lists" },
    ],
  },
  {
    label: "Campanhas e Disparos",
    items: [
      { icon: FileText, label: "Templates", path: "/templates", permission: "view_templates" },
      { icon: Send, label: "Disparos", path: "/campaigns", permission: "view_campaigns" },
      { icon: Bot, label: "Chatbots", path: "/chatbots", permission: "view_chatbots" },
    ],
  },
  {
    label: "Sua Conta",
    items: [
      { icon: CreditCard, label: "Assinatura", path: "/subscription", permission: "manage_subscription" },
      { icon: Settings, label: "Configurações", path: "/settings", permission: "manage_settings" },
    ],
  },
];

export const MobileSidebarDrawer = () => {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan, isSubscribed } = useSubscription();
  const { conversations } = useConversations();
  const { isMobileOpen, closeMobile } = useSidebarContext();
  const { checkPermission, organization, isLoading: isLoadingOrg } = useOrganization();
  
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  // Map de features premium
  const featureMap: Record<string, string> = {
    '/warming': 'warming',
    '/funnels': 'funnels',
    '/broadcast-lists': 'broadcast',
    '/analysis': 'analysis',
    '/lead-search': 'lead_search',
  };

  const filterItems = (items: NavItem[]) => {
    // Se ainda está carregando organização, não mostrar nenhum item
    if (isLoadingOrg) return [];
    
    return items.filter(item => {
      // Check plan-based feature access
      const featureKey = featureMap[item.path];
      if (featureKey && !hasFeatureAccess(currentPlan, featureKey)) {
        return false;
      }

      // Se não tem organização, permite tudo (usuário individual/legado)
      if (!organization) return true;
      // Se não tem permissão definida, mostra o item
      if (!item.permission) return true;
      // Verificar permissão do membro
      return checkPermission(item.permission);
    });
  };

  const handleLogout = async () => {
    closeMobile();
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair: " + error.message);
    } else {
      toast.success("Logout realizado com sucesso");
      navigate("/login");
    }
  };

  const handleNavigate = (path: string) => {
    closeMobile();
    navigate(path);
  };

  return (
    <Sheet open={isMobileOpen} onOpenChange={(open) => !open && closeMobile()}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-r-0">
        <SheetHeader className="h-14 flex flex-row items-center justify-between px-4 border-b border-sidebar-border/30">
          <img src={wideLogo} alt="Widezap" className="h-8 w-auto" />
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobile}
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-14rem)]">
          <nav className="py-4 px-3">
            {navGroups.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && "mt-4")}>
                <span className="px-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </span>
                <div className="space-y-0.5 mt-1">
                  {filterItems(group.items).map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.showBadge && totalUnread > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="h-5 min-w-5 px-1.5 text-xs font-bold"
                          >
                            {totalUnread > 99 ? '99+' : totalUnread}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {isAdmin && (
              <div className="mt-4">
                <button
                  onClick={() => handleNavigate("/admin")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    location.pathname === "/admin"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
                  )}
                >
                  <Shield className="h-5 w-5" />
                  Admin
                </button>
              </div>
            )}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border/30 p-4 space-y-2 bg-sidebar">
          <button 
            onClick={() => handleNavigate("/subscription")}
            className="w-full bg-sidebar-accent/50 rounded-xl p-4 hover:bg-sidebar-accent transition-colors text-left"
          >
            <p className="text-xs text-sidebar-foreground/60 mb-1">Plano Ativo</p>
            <p className="text-sm font-semibold text-sidebar-primary">
              {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
            </p>
          </button>
          
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <LogOut className="h-5 w-5" />
            Sair do Sistema
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
