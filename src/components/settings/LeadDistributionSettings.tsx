import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeadDistribution } from "@/hooks/useLeadDistribution";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Shuffle, Users, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LeadDistributionSettings() {
  const { settings, isLoading, updateSettings } = useLeadDistribution();
  const { members, isLoading: isLoadingMembers } = useTeamMembers();

  const [isEnabled, setIsEnabled] = useState(false);
  const [eligibleMembers, setEligibleMembers] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize state from settings
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setEligibleMembers(settings.eligible_members || []);
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (!settings) {
      setHasChanges(isEnabled || eligibleMembers.length > 0);
      return;
    }
    const changed =
      isEnabled !== settings.is_enabled ||
      JSON.stringify(eligibleMembers.sort()) !== JSON.stringify((settings.eligible_members || []).sort());
    setHasChanges(changed);
  }, [isEnabled, eligibleMembers, settings]);

  const handleToggleMember = (userId: string, checked: boolean) => {
    if (checked) {
      setEligibleMembers([...eligibleMembers, userId]);
    } else {
      setEligibleMembers(eligibleMembers.filter((id) => id !== userId));
    }
  };

  const handleSelectAll = () => {
    const activeMembers = members?.filter((m) => m.status === "active" && m.user_id);
    setEligibleMembers(activeMembers?.map((m) => m.user_id!) || []);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      is_enabled: isEnabled,
      eligible_members: eligibleMembers,
      distribution_mode: "round_robin",
    });
    setHasChanges(false);
  };

  const activeMembers = members?.filter((m) => m.status === "active" && m.user_id) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shuffle className="h-5 w-5" />
          Distribuição Automática de Leads
        </CardTitle>
        <CardDescription>
          Quando ativado, novos leads serão automaticamente atribuídos aos atendentes selecionados usando o método round-robin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="distribution-enabled">Ativar Distribuição Automática</Label>
            <p className="text-sm text-muted-foreground">
              Novos leads serão distribuídos automaticamente
            </p>
          </div>
          <Switch
            id="distribution-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            disabled={isLoading}
          />
        </div>

        {/* Eligible Members */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Atendentes Elegíveis
            </Label>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              Selecionar Todos
            </Button>
          </div>

          {isLoadingMembers ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : activeMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum membro ativo encontrado
            </p>
          ) : (
            <div className="border rounded-lg divide-y">
              {activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`member-${member.id}`}
                    checked={eligibleMembers.includes(member.user_id!)}
                    onCheckedChange={(checked) =>
                      handleToggleMember(member.user_id!, checked as boolean)
                    }
                    disabled={!isEnabled}
                  />
                  <Label
                    htmlFor={`member-${member.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <span className="font-medium">
                      {member.profile?.full_name || member.email}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({member.role})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateSettings.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
