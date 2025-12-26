import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Loader2, Globe } from 'lucide-react';
import { TeamMember } from '@/hooks/useOrganization';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useMemberInstances } from '@/hooks/useMemberInstances';

interface MemberInstancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberInstancesDialog({ open, onOpenChange, member }: MemberInstancesDialogProps) {
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [allInstancesSelected, setAllInstancesSelected] = useState(true);
  
  const { instances, isLoading: isLoadingInstances } = useWhatsAppInstances();
  const { memberInstanceIds, isLoading: isLoadingMember, updateMemberInstances } = useMemberInstances(member.id);

  // Initialize selection when dialog opens or data loads
  useEffect(() => {
    if (open && memberInstanceIds !== undefined) {
      if (memberInstanceIds.length === 0) {
        // No specific instances = all access
        setAllInstancesSelected(true);
        setSelectedInstances([]);
      } else {
        setAllInstancesSelected(false);
        setSelectedInstances(memberInstanceIds);
      }
    }
  }, [open, memberInstanceIds]);

  const handleToggleInstance = (instanceId: string) => {
    setSelectedInstances(prev => 
      prev.includes(instanceId)
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  const handleToggleAllInstances = (checked: boolean) => {
    setAllInstancesSelected(checked);
    if (checked) {
      setSelectedInstances([]);
    }
  };

  const handleSave = async () => {
    await updateMemberInstances.mutateAsync({
      memberId: member.id,
      instanceIds: allInstancesSelected ? [] : selectedInstances,
    });
    onOpenChange(false);
  };

  const isLoading = isLoadingInstances || isLoadingMember;
  const canSave = allInstancesSelected || selectedInstances.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Instâncias de Acesso
          </DialogTitle>
          <DialogDescription>
            Selecione quais números de WhatsApp {member.profile?.full_name || member.email} pode acessar no inbox.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* All instances option */}
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="all-instances"
                checked={allInstancesSelected}
                onCheckedChange={handleToggleAllInstances}
              />
              <label 
                htmlFor="all-instances" 
                className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
              >
                <Globe className="h-4 w-4 text-primary" />
                Todas as instâncias
                <Badge variant="secondary" className="ml-auto">Sem restrição</Badge>
              </label>
            </div>

            {!allInstancesSelected && (
              <>
                <p className="text-sm text-muted-foreground">
                  Ou selecione instâncias específicas:
                </p>
                
                <ScrollArea className="h-[250px] rounded-lg border p-3">
                  <div className="space-y-2">
                    {instances?.map((instance) => (
                      <div 
                        key={instance.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={instance.id}
                          checked={selectedInstances.includes(instance.id)}
                          onCheckedChange={() => handleToggleInstance(instance.id)}
                        />
                        <label 
                          htmlFor={instance.id} 
                          className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                        >
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{instance.instance_name}</span>
                          <Badge 
                            variant={instance.status === 'connected' ? 'default' : 'secondary'}
                            className="ml-auto"
                          >
                            {instance.status === 'connected' ? 'Conectado' : 'Desconectado'}
                          </Badge>
                        </label>
                      </div>
                    ))}
                    
                    {(!instances || instances.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma instância encontrada
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!canSave || updateMemberInstances.isPending}
          >
            {updateMemberInstances.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
