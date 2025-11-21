import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações da sua conta
          </p>
        </div>

        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-primary mb-6">
            <SettingsIcon className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Em breve!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            As configurações estão sendo desenvolvidas e estarão disponíveis em breve.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Settings;
