import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter } from "lucide-react";
import { useFunnels } from "@/hooks/useFunnels";
import { useMemberFunnels } from "@/hooks/useMemberFunnels";
import { TeamMember } from "@/hooks/useOrganization";

interface MemberFunnelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberFunnelsDialog({ open, onOpenChange, member }: MemberFunnelsDialogProps) {
  const { funnels, isLoading: isLoadingFunnels } = useFunnels();
  const { memberFunnelIds, isLoading: isLoadingMemberFunnels, updateMemberFunnels } = useMemberFunnels(member.id);
  
  const [selectedFunnels, setSelectedFunnels] = useState<string[]>([]);
  const [allFunnelsSelected, setAllFunnelsSelected] = useState(true);

  useEffect(() => {
    if (open) {
      if (memberFunnelIds.length === 0) {
        // No restrictions - all funnels accessible
        setAllFunnelsSelected(true);
        setSelectedFunnels([]);
      } else {
        setAllFunnelsSelected(false);
        setSelectedFunnels(memberFunnelIds);
      }
    }
  }, [open, memberFunnelIds]);

  const handleToggleFunnel = (funnelId: string) => {
    setSelectedFunnels(prev => 
      prev.includes(funnelId)
        ? prev.filter(id => id !== funnelId)
        : [...prev, funnelId]
    );
  };

  const handleToggleAllFunnels = (checked: boolean) => {
    setAllFunnelsSelected(checked);
    if (checked) {
      setSelectedFunnels([]);
    }
  };

  const handleSave = async () => {
    // If "all funnels" is selected, we save empty array (no restrictions)
    const funnelIdsToSave = allFunnelsSelected ? [] : selectedFunnels;
    
    await updateMemberFunnels.mutateAsync({
      teamMemberId: member.id,
      funnelIds: funnelIdsToSave,
    });
    
    onOpenChange(false);
  };

  const isLoading = isLoadingFunnels || isLoadingMemberFunnels;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Funis de Acesso
          </DialogTitle>
          <DialogDescription>
            Defina quais funis o membro <strong>{member.profile?.full_name || member.email}</strong> pode acessar no inbox.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* All Funnels Option */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/50">
              <Checkbox
                id="all-funnels"
                checked={allFunnelsSelected}
                onCheckedChange={handleToggleAllFunnels}
              />
              <div className="flex-1">
                <Label htmlFor="all-funnels" className="cursor-pointer font-medium">
                  Todos os funis
                </Label>
                <p className="text-sm text-muted-foreground">
                  O membro terá acesso a todas as conversas
                </p>
              </div>
              <Badge variant="secondary">Padrão</Badge>
            </div>

            {/* Individual Funnel Selection */}
            {!allFunnelsSelected && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Selecione os funis permitidos:
                </Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {funnels?.map((funnel) => (
                    <div
                      key={funnel.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`funnel-${funnel.id}`}
                        checked={selectedFunnels.includes(funnel.id)}
                        onCheckedChange={() => handleToggleFunnel(funnel.id)}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: funnel.color }}
                        />
                        <Label htmlFor={`funnel-${funnel.id}`} className="cursor-pointer">
                          {funnel.name}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedFunnels.length === 0 && (
                  <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                    Selecione pelo menos um funil ou marque "Todos os funis"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMemberFunnels.isPending || (!allFunnelsSelected && selectedFunnels.length === 0)}
          >
            {updateMemberFunnels.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
