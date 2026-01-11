import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ElevenLabsSIPSettings } from "@/components/settings/ElevenLabsSIPSettings";
import { AITokensSettings } from "@/components/ai-tokens/AITokensSettings";
import { User, Server, Database, Users, Plug, Smartphone, Bell, Phone, Coins, LucideIcon } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { PermissionKey } from "@/config/permissions";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  adminOnly?: boolean;
  component: React.ComponentType;
}

const allTabs: SettingsTab[] = [
  { value: "profile", label: "Perfil", icon: User, component: ProfileSettings },
  { value: "ai-tokens", label: "Tokens AI", icon: Coins, component: AITokensSettings },
  { value: "notifications", label: "Notificações", icon: Bell, permission: "manage_notification_settings", component: NotificationSettings },
  { value: "team", label: "Equipe", icon: Users, permission: "invite_members", adminOnly: true, component: TeamSettings },
  { value: "whatsapp", label: "WhatsApp", icon: Smartphone, permission: "view_instances", component: WhatsAppSettings },
  { value: "sip-calls", label: "Chamadas IA", icon: Phone, permission: "manage_settings", adminOnly: true, component: ElevenLabsSIPSettings },
  { value: "integrations", label: "Integrações", icon: Plug, permission: "manage_settings", adminOnly: true, component: IntegrationsSettings },
  { value: "api", label: "API", icon: Server, permission: "manage_settings", adminOnly: true, component: ApiSettings },
  { value: "data", label: "Dados", icon: Database, permission: "manage_settings", adminOnly: true, component: DataSettings },
];

const Settings = () => {
  const { isAdmin, checkPermission, organization, isLoading } = useOrganization();
  const [searchParams] = useSearchParams();

  // Filtrar abas baseado em permissões
  const visibleTabs = useMemo(() => {
    if (isLoading) return [allTabs[0]]; // Só mostra perfil enquanto carrega
    
    return allTabs.filter(tab => {
      // Perfil e ai-tokens sempre visível
      if (tab.value === "profile" || tab.value === "ai-tokens") return true;
      
      // Se não tem organização, mostra tudo (legado)
      if (!organization) return true;
      
      // Se é admin, mostra tudo
      if (isAdmin) return true;
      
      // Se é admin-only e não é admin, oculta
      if (tab.adminOnly) return false;
      
      // Checar permissão se definida
      if (tab.permission) {
        return checkPermission(tab.permission);
      }
      
      return true;
    });
  }, [isLoading, organization, isAdmin, checkPermission]);

  // Determinar aba padrão (do URL ou primeira visível)
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = (tabFromUrl && visibleTabs.some(t => t.value === tabFromUrl)) 
    ? tabFromUrl 
    : visibleTabs[0]?.value || "profile";

  return (
    <DashboardLayout className="p-8 animated-gradient cyber-grid relative">
      {/* Ambient glow effects */}
      <div className="fixed top-20 right-1/4 w-64 h-64 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 left-1/3 w-64 h-64 bg-neon-magenta/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mb-8 relative z-10">
        <h1 className="text-3xl font-display font-bold mb-2 text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta e preferências de envio
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6 relative z-10">
        <TabsList className={`grid w-full bg-secondary/50 p-1`} style={{ gridTemplateColumns: `repeat(${Math.min(visibleTabs.length, 5)}, 1fr)` }}>
          {visibleTabs.map(tab => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
