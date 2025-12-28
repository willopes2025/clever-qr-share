import { Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarContext } from "@/contexts/SidebarContext";
import wideLogo from "@/assets/wide-logo.png";
import { useConversations } from "@/hooks/useConversations";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export const MobileHeader = () => {
  const { openMobile } = useSidebarContext();
  const { conversations } = useConversations();
  const navigate = useNavigate();
  
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unread_count, 0) || 0;

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border/30 flex items-center justify-between px-3 z-50 md:hidden">
      {/* Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobile}
        className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo */}
      <img src={wideLogo} alt="Widezap" className="h-8 w-auto" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/inbox")}
          className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent relative"
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
          className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};
