import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { useSidebarContext } from "@/contexts/SidebarContext";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", showBadge: true },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: MoreHorizontal, label: "Mais", path: "more", isMenu: true },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { conversations } = useConversations();
  const { openMobile } = useSidebarContext();
  
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border/30 flex items-center justify-around px-2 z-50 md:hidden safe-area-bottom">
      {navItems.map((item) => {
        if (item.isMenu) {
          return (
            <button
              key={item.label}
              onClick={openMobile}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        }

        const isActive = location.pathname === item.path;
        
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors relative",
              isActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {item.showBadge && totalUnread > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[9px] font-bold"
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sidebar-primary rounded-full" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
