import { useState } from "react";
import { RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { EmptyDashboardState } from "./EmptyDashboardState";
import { AddKPIButton } from "./AddKPIButton";
import { KPISelectionModal } from "./KPISelectionModal";
import { DashboardWidgetGrid } from "./DashboardWidgetGrid";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const CustomizableDashboard = () => {
  const { 
    config, 
    availableWidgets, 
    loading, 
    addWidgets,
    removeWidget,
    updateWidgetSize,
    resetDashboard 
  } = useDashboardConfig();
  const { isAdmin, role } = useUserRole();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const widgets = config?.widgets || [];
  const hasWidgets = widgets.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Dashboard {isAdmin ? 'Administrativo' : 'do Membro'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin 
              ? 'Visão completa de performance, vendas e equipe'
              : 'Sua performance e métricas pessoais'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasWidgets && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resetar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resetar Dashboard?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá remover todos os widgets e retornar ao estado inicial. 
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={resetDashboard}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <AddKPIButton onClick={() => setIsModalOpen(true)} />
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {hasWidgets ? (
        <DashboardWidgetGrid
          widgets={widgets}
          availableWidgets={availableWidgets}
          onRemoveWidget={removeWidget}
          onResizeWidget={updateWidgetSize}
        />
      ) : (
        <EmptyDashboardState onAddKPIs={() => setIsModalOpen(true)} />
      )}

      {/* KPI Selection Modal */}
      <KPISelectionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        availableWidgets={availableWidgets}
        currentWidgets={widgets}
        onAddWidgets={addWidgets}
      />
    </div>
  );
};
