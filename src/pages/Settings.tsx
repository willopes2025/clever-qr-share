import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SendingSettings } from "@/components/settings/SendingSettings";
import { CampaignSettings } from "@/components/settings/CampaignSettings";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { User, MessageSquare, Megaphone, Server, Database } from "lucide-react";

const Settings = () => {
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

      <Tabs defaultValue="profile" className="space-y-6 relative z-10">
        <TabsList className="grid w-full grid-cols-5 bg-secondary/50 p-1">
          <TabsTrigger value="profile" className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="sending" className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Envio</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Campanhas</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">API</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2 font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-glow-cyan">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Dados</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="sending">
          <SendingSettings />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignSettings />
        </TabsContent>

        <TabsContent value="api">
          <ApiSettings />
        </TabsContent>

        <TabsContent value="data">
          <DataSettings />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;