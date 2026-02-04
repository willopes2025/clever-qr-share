import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";
import { motion } from "framer-motion";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  permission?: PermissionKey;
  showBadge?: boolean;
  isMenu?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permission: "view_dashboard" },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", permission: "view_inbox", showBadge: true },
  { icon: Users, label: "Contatos", path: "/contacts", permission: "view_contacts" },
  { icon: MoreHorizontal, label: "Mais", path: "more", isMenu: true },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { conversations } = useConversations();
  const { openMobile } = useSidebarContext();
  const { checkPermission, organization, isLoading } = useOrganization();
  
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  // Filter items by permission
  const filteredItems = navItems.filter(item => {
    if (item.isMenu) return true;
    if (isLoading) return false;
    if (!organization) return true;
    if (!item.permission) return true;
    return checkPermission(item.permission);
  });

  const handleHapticFeedback = () => {
    // Trigger haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border/30 flex items-center justify-around px-2 z-50 safe-area-bottom">
      {filteredItems.map((item) => {
        if (item.isMenu) {
          return (
            <motion.button
              key={item.label}
              onClick={() => {
                handleHapticFeedback();
                openMobile();
              }}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors active:bg-sidebar-accent"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </motion.button>
          );
        }

        const isActive = location.pathname === item.path;
        
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleHapticFeedback}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl transition-all relative",
              isActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground active:bg-sidebar-accent"
            )}
          >
            <motion.div 
              className="relative"
              whileTap={{ scale: 0.9 }}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              {item.showBadge && totalUnread > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[9px] font-bold"
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </motion.div>
            <span className={cn(
              "text-[10px] font-medium transition-all",
              isActive && "font-semibold"
            )}>
              {item.label}
            </span>
            {isActive && (
              <motion.div 
                layoutId="bottomNavIndicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sidebar-primary rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
