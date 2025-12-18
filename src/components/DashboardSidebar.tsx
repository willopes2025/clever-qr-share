import { NavLink, useNavigate } from "react-router-dom";
import { MessageSquare, LayoutDashboard, QrCode, Send, Users, List, FileText, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: QrCode, label: "Instâncias", path: "/instances" },
  { icon: Users, label: "Contatos", path: "/contacts" },
  { icon: List, label: "Listas", path: "/broadcast-lists" },
  { icon: FileText, label: "Templates", path: "/templates" },
  { icon: Send, label: "Disparos", path: "/campaigns" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export const DashboardSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-sidebar-foreground">DisparaZap</span>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="bg-sidebar-accent rounded-lg p-4">
          <p className="text-xs text-sidebar-foreground/70 mb-2">Plano Gratuito</p>
          <p className="text-sm font-medium text-sidebar-foreground">QR Codes Ilimitados</p>
        </div>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Sair do Sistema
        </Button>
      </div>
    </aside>
  );
};
