import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut, CreditCard, Shield, MessageSquare, Flame, PanelLeftClose, PanelLeft, BarChart3, Target, ChevronRight, Building2, CalendarDays, Bot, User, Sparkles, Wallet, FileEdit, Glasses, Instagram } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarContext } from "@/contexts/SidebarContext";
import wideLogo from "@/assets/wide-logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";
import { SessionStatusBadge } from "@/components/productivity/SessionStatusBadge";

import { useAsaas } from "@/hooks/useAsaas";
import { useSsotica } from "@/hooks/useSsotica";
import { useActivitySession } from "@/hooks/useActivitySession";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  path: string;
  permission?: PermissionKey;
  showBadge?: boolean;
  premiumOnly?: boolean;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: "navigation.groups.overview",
    items: [
      { icon: LayoutDashboard, labelKey: "navigation.dashboard", path: "/dashboard", permission: "view_dashboard" },
    ],
  },
  {
    labelKey: "navigation.groups.whatsapp",
    items: [
      { icon: QrCode, labelKey: "navigation.instances", path: "/instances", permission: "view_instances" },
      { icon: Flame, labelKey: "navigation.warming", path: "/warming", permission: "view_warming" },
    ],
  },
  {
    labelKey: "navigation.groups.sales",
    items: [
      { icon: MessageSquare, labelKey: "navigation.chat", path: "/inbox", permission: "view_inbox", showBadge: true },
      { icon: Target, labelKey: "navigation.funnels", path: "/funnels", permission: "view_funnels" },
      { icon: CalendarDays, labelKey: "navigation.calendar", path: "/calendar", permission: "view_calendar" },
      { icon: BarChart3, labelKey: "navigation.analysis", path: "/analysis", permission: "view_analysis", premiumOnly: true },
    ],
  },
  {
    labelKey: "navigation.groups.clients",
    items: [
      { icon: Users, labelKey: "navigation.contacts", path: "/contacts", permission: "view_contacts" },
      { icon: Building2, labelKey: "navigation.leadSearch", path: "/lead-search", permission: "search_leads" },
      { icon: Instagram, labelKey: "navigation.instagramLeads", path: "/instagram-scraper", permission: "search_leads" },
      { icon: List, labelKey: "navigation.lists", path: "/broadcast-lists", permission: "view_lists" },
    ],
  },
  {
    labelKey: "navigation.groups.campaigns",
    items: [
      { icon: FileText, labelKey: "navigation.templates", path: "/templates", permission: "view_templates" },
      { icon: Send, labelKey: "navigation.campaignsSend", path: "/campaigns", permission: "view_campaigns" },
      { icon: FileEdit, labelKey: "navigation.forms", path: "/forms", permission: "view_forms" },
      { icon: Bot, labelKey: "navigation.chatbots", path: "/chatbots", permission: "view_chatbots" },
      { icon: Sparkles, labelKey: "navigation.aiAgents", path: "/ai-agents", permission: "view_ai_agents" },
    ],
  },
  {
    labelKey: "navigation.groups.account",
    items: [
      { icon: CreditCard, labelKey: "navigation.subscription", path: "/subscription", permission: "manage_subscription" },
      { icon: Settings, labelKey: "navigation.settings", path: "/settings", permission: "manage_settings" },
    ],
  },
];

export const DashboardSidebar = () => {
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const { isAdmin: isSystemAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlan, isSubscribed } = useSubscription();
  const { data: totalUnread = 0 } = useUnreadCount();
  const { isCollapsed, toggle } = useSidebarContext();
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const { checkPermission, organization, isLoading: isLoadingOrg, isAdmin: isOrgAdmin } = useOrganization();
  const { profile } = useProfile();
  const { hasAsaas } = useAsaas();
  const { hasSsotica } = useSsotica();

  // Build dynamic nav groups with Financeiro/ssOtica if connected
  // For organization members: show these items based on permissions (even if integration isn't connected yet)
  const dynamicNavGroups = navGroups.map(group => {
    if (group.labelKey === "navigation.groups.account") {
      const dynamicItems: NavItem[] = [];
      
      if (hasAsaas) {
        dynamicItems.push({ icon: Wallet, labelKey: "navigation.financeiro", path: "/financeiro", permission: "view_finances" as const });
      }
      if (hasSsotica) {
        dynamicItems.push({ icon: Glasses, labelKey: "navigation.ssotica", path: "/ssotica", permission: "view_ssotica" as const });
      }
      
      return {
        ...group,
        items: [...dynamicItems, ...group.items],
      };
    }
    return group;
  });

  // Filter nav items based on permissions only (NOT plan-based)
  // Plan-based restrictions should NOT hide menu items - they should be visible but locked
  const filterItems = (items: NavItem[]) => {
    // Se ainda está carregando organização, não mostrar nenhum item
    if (isLoadingOrg) return [];
    
    return items.filter(item => {
      // Se não tem organização, permite tudo (usuário individual/legado)
      if (!organization) return true;
      // Se não tem permissão definida, mostra o item
      if (!item.permission) return true;
      // Verificar permissão do membro
      return checkPermission(item.permission);
    });
  };

  // Check if current route is in a group
  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => location.pathname === item.path);
  };

  // Check if group should be expanded (hovered or active route)
  const isGroupExpanded = (group: NavGroup) => {
    return hoveredGroup === group.labelKey || isGroupActive(group);
  };

  const { endSession } = useActivitySession();

  const handleLogout = async () => {
    // End activity session before logout
    await endSession();
    
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair: " + error.message);
    } else {
      toast.success(t('auth.logoutSuccess'));
      navigate("/login");
    }
  };

  const renderNavItem = (item: NavItem) => {
    const label = t(item.labelKey);
    const linkContent = (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) =>
          cn(
            "flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative",
            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2.5",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1">{label}</span>
            {item.showBadge && totalUnread > 0 && (
              <Badge 
                variant="destructive" 
                className="h-5 min-w-5 px-1.5 text-xs font-bold animate-pulse"
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </>
        )}
        {isCollapsed && item.showBadge && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {label}
            {item.showBadge && totalUnread > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar flex flex-col shadow-elevated transition-all duration-300 ease-in-out z-40",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo and Toggle */}
        <div className={cn(
          "h-16 flex items-center border-b border-sidebar-border/30",
          isCollapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!isCollapsed && (
            <img src={wideLogo} alt="Widezap" className="h-10 w-auto" />
          )}
          <div className="flex items-center gap-2">
            {!isCollapsed && <SessionStatusBadge />}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4 overflow-y-auto",
          isCollapsed ? "px-2" : "px-3"
        )}>
          {dynamicNavGroups.map((group, groupIndex) => (
            <div 
              key={group.labelKey} 
              className={cn(groupIndex > 0 && "mt-2")}
              onMouseEnter={() => !isCollapsed && setHoveredGroup(group.labelKey)}
              onMouseLeave={() => !isCollapsed && setHoveredGroup(null)}
            >
              {/* Group Label - hidden when collapsed */}
              {!isCollapsed && (
                <div 
                  className={cn(
                    "px-4 py-2 cursor-pointer rounded-lg transition-all duration-200 flex items-center justify-between",
                    isGroupExpanded(group) 
                      ? "bg-sidebar-accent/50" 
                      : "hover:bg-sidebar-accent/30"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200",
                    isGroupActive(group) 
                      ? "text-sidebar-primary" 
                      : "text-sidebar-foreground/50"
                  )}>
                    {t(group.labelKey)}
                  </span>
                  <motion.div
                    animate={{ rotate: isGroupExpanded(group) ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className={cn(
                      "h-3 w-3 transition-colors duration-200",
                      isGroupActive(group) 
                        ? "text-sidebar-primary" 
                        : "text-sidebar-foreground/40"
                    )} />
                  </motion.div>
                </div>
              )}
              
              {/* Separator when collapsed */}
              {isCollapsed && groupIndex > 0 && (
                <div className="my-2 mx-2 border-t border-sidebar-border/20" />
              )}
              
              {/* Group Items - animated */}
              {isCollapsed ? (
                <div className="space-y-0.5">
                  {filterItems(group.items).map(renderNavItem)}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {isGroupExpanded(group) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pt-1">
                        {filterItems(group.items).map(renderNavItem)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
          
          {/* Admin Link */}
          {isSystemAdmin && (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cn(
                        "flex items-center justify-center p-3 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-amber-500/20 text-amber-300"
                          : "text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300"
                      )
                    }
                  >
                    <Shield className="h-5 w-5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{t('navigation.admin')}</TooltipContent>
              </Tooltip>
            ) : (
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
                {t('navigation.admin')}
              </NavLink>
            )
          )}
        </nav>

        {/* Bottom section */}
        <div className={cn(
          "border-t border-sidebar-border/30 space-y-2",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {isCollapsed ? (
            <>
              {/* Avatar quando colapsado */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center">
                    <Avatar className="h-10 w-10 cursor-pointer border-2 border-sidebar-accent">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{profile?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink to="/subscription" className="block">
                    <div className="bg-sidebar-accent/50 rounded-xl p-3 hover:bg-sidebar-accent transition-colors cursor-pointer flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-sidebar-primary" />
                    </div>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs text-muted-foreground">{t('navigation.subscription')}</p>
                  <p className="text-sm font-semibold">
                    {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleLogout}
                    className="w-full h-10 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('navigation.logout')}</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              {/* Usuário Logado */}
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="h-9 w-9 border-2 border-sidebar-accent">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Plan Card */}
              <NavLink to="/subscription" className="block">
                <div className="bg-sidebar-accent/50 rounded-xl p-3 hover:bg-sidebar-accent transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-sidebar-primary" />
                      <span className="text-xs text-sidebar-foreground/70">{t('navigation.subscription')}</span>
                    </div>
                    <span className="text-xs font-semibold text-sidebar-primary">
                      {isSubscribed ? (PLANS[currentPlan as keyof typeof PLANS]?.name?.toUpperCase() || currentPlan.toUpperCase()) : 'NENHUM PLANO'}
                    </span>
                  </div>
                </div>
              </NavLink>

              {/* Logout Button */}
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
                {t('navigation.logout')}
              </Button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};
