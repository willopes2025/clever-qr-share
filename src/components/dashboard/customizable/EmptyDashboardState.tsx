import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyDashboardStateProps {
  onAddKPIs: () => void;
}

export const EmptyDashboardState = ({ onAddKPIs }: EmptyDashboardStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="p-6 bg-muted/30 rounded-full">
        <LayoutDashboard className="h-16 w-16 text-muted-foreground" />
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">
          Monte sua Dashboard Personalizada
        </h2>
        <p className="text-muted-foreground max-w-md">
          Escolha os KPIs e métricas mais importantes para você. 
          Personalize sua visão com dados de performance, vendas, atendimento e muito mais.
        </p>
      </div>
      
      <Button 
        size="lg" 
        onClick={onAddKPIs}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-6 text-lg"
      >
        Adicionar KPIs
      </Button>
    </div>
  );
};
