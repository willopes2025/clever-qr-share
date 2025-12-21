import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw, Flame } from "lucide-react";
import { useWarming } from "@/hooks/useWarming";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { WarmingProgressCard } from "@/components/warming/WarmingProgressCard";
import { WarmingContactsManager } from "@/components/warming/WarmingContactsManager";
import { WarmingPairsManager } from "@/components/warming/WarmingPairsManager";
import { WarmingContentManager } from "@/components/warming/WarmingContentManager";
import { WarmingActivitiesLog } from "@/components/warming/WarmingActivitiesLog";
import { StartWarmingDialog } from "@/components/warming/StartWarmingDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function Warming() {
  const { instances } = useWhatsAppInstances();
  const {
    schedules, contacts, pairs, contents, activities, isLoading,
    createSchedule, updateScheduleStatus, createContact, deleteContact,
    createPair, deletePair, createContent, deleteContent, triggerWarming, refetch
  } = useWarming();

  const existingScheduleInstanceIds = schedules?.map(s => s.instance_id) || [];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar />
        <SidebarInset className="flex-1">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="h-8 w-8 text-orange-500" />
                <div>
                  <h1 className="text-2xl font-bold">Aquecimento de Chip</h1>
                  <p className="text-muted-foreground">Aqueça suas instâncias para evitar bloqueios</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => triggerWarming.mutate()} disabled={triggerWarming.isPending}>
                  Executar Agora
                </Button>
                <StartWarmingDialog
                  instances={instances || []}
                  existingScheduleInstanceIds={existingScheduleInstanceIds}
                  onStart={(data) => createSchedule.mutate(data)}
                  isStarting={createSchedule.isPending}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : (
              <>
                {/* Active Schedules */}
                {schedules && schedules.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Aquecimentos Ativos</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {schedules.map((schedule) => (
                        <WarmingProgressCard
                          key={schedule.id}
                          schedule={schedule}
                          onToggleStatus={(id, status) => updateScheduleStatus.mutate({ scheduleId: id, status })}
                          isToggling={updateScheduleStatus.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Configuration */}
                <div className="grid gap-6 md:grid-cols-2">
                  <WarmingPairsManager
                    pairs={pairs || []}
                    instances={instances || []}
                    onAdd={(data) => createPair.mutate(data)}
                    onDelete={(id) => deletePair.mutate(id)}
                    isAdding={createPair.isPending}
                  />
                  <WarmingContactsManager
                    contacts={contacts || []}
                    onAdd={(data) => createContact.mutate(data)}
                    onDelete={(id) => deleteContact.mutate(id)}
                    isAdding={createContact.isPending}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <WarmingContentManager
                    contents={contents || []}
                    onAdd={(data) => createContent.mutate(data)}
                    onDelete={(id) => deleteContent.mutate(id)}
                    isAdding={createContent.isPending}
                  />
                  <WarmingActivitiesLog activities={activities || []} />
                </div>
              </>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
