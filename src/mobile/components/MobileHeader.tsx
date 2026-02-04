import { Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarContext } from "@/contexts/SidebarContext";
import wideLogo from "@/assets/wide-logo.png";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { SessionStatusBadge } from "@/components/productivity/SessionStatusBadge";
import { motion } from "framer-motion";

interface MobileHeaderProps {
  pageTitle?: string;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contatos",
  "/funnels": "Funis",
  "/campaigns": "Campanhas",
  "/settings": "Configurações",
  "/ai-agents": "Agentes IA",
  "/automations": "Automações",
};

export const MobileHeader = ({ pageTitle }: MobileHeaderProps) => {
  const { openMobile } = useSidebarContext();
  const { conversations } = useConversations();
  const navigate = useNavigate();
  const location = useLocation();
  
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;
  
  // Get dynamic page title
  const currentTitle = pageTitle || pageTitles[location.pathname] || "";
  const showTitle = currentTitle && location.pathname !== "/dashboard";

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border/30 flex items-center justify-between px-3 z-50 safe-area-top">
      {/* Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobile}
        className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent active:scale-95 transition-transform"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo or Page Title */}
      {showTitle ? (
        <motion.h1 
          key={currentTitle}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sidebar-foreground font-semibold text-base"
        >
          {currentTitle}
        </motion.h1>
      ) : (
        <img src={wideLogo} alt="Widezap" className="h-8 w-auto" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        <SessionStatusBadge />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/inbox")}
          className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent active:scale-95 transition-transform relative"
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold animate-pulse"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
          className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent active:scale-95 transition-transform"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};
