import { useState, useEffect, useRef } from 'react';
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
import { Smartphone, Loader2, Globe, MessageSquare } from 'lucide-react';
import { TeamMember } from '@/hooks/useOrganization';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useMemberInstances } from '@/hooks/useMemberInstances';
import { useMetaWhatsAppNumbers } from '@/hooks/useMetaWhatsAppNumbers';
import { useMemberMetaNumbers } from '@/hooks/useMemberMetaNumbers';

interface MemberInstancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberInstancesDialog({ open, onOpenChange, member }: MemberInstancesDialogProps) {
  // Evolution state
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [allInstancesSelected, setAllInstancesSelected] = useState(true);
  
  // Meta state
  const [selectedMetaNumbers, setSelectedMetaNumbers] = useState<string[]>([]);
  const [allMetaSelected, setAllMetaSelected] = useState(true);
  
  const hasInitialized = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Evolution hooks
  const { instances: allInstances, isLoading: isLoadingInstances } = useWhatsAppInstances();
  const { memberInstanceIds, isLoading: isLoadingMemberInstances, updateMemberInstances } = useMemberInstances(member.id);
  
  // Meta hooks
  const { metaNumbers, isLoading: isLoadingMetaNumbers } = useMetaWhatsAppNumbers();
  const { memberMetaNumberIds, isLoading: isLoadingMemberMeta, updateMemberMetaNumbers } = useMemberMetaNumbers(member.id);

  // Filter instances
  const instances = allInstances?.filter(i => !i.is_notification_only) || [];
  const activeMetaNumbers = metaNumbers?.filter(n => n.is_active) || [];

  const hasEvolutionInstances = instances.length > 0;
  const hasMetaNumbers = activeMetaNumbers.length > 0;

  // Initialize selection only once when dialog opens
  useEffect(() => {
    if (open && memberInstanceIds !== undefined && memberMetaNumberIds !== undefined && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // Evolution
      if (memberInstanceIds.length === 0) {
        setAllInstancesSelected(true);
        setSelectedInstances([]);
      } else {
        setAllInstancesSelected(false);
        setSelectedInstances(memberInstanceIds);
      }
      
      // Meta
      if (memberMetaNumberIds.length === 0) {
        setAllMetaSelected(true);
        setSelectedMetaNumbers([]);
      } else {
        setAllMetaSelected(false);
        setSelectedMetaNumbers(memberMetaNumberIds);
      }
    }
    
    if (!open) {
      hasInitialized.current = false;
    }
  }, [open, memberInstanceIds, memberMetaNumberIds]);

  // Evolution handlers
  const handleToggleInstance = (instanceId: string) => {
    setSelectedInstances(prev => 
      prev.includes(instanceId)
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  const handleToggleAllInstances = (checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setAllInstancesSelected(isChecked);
    if (isChecked) {
      setSelectedInstances([]);
    } else {
      setSelectedInstances(instances?.map(i => i.id) || []);
    }
  };

  // Meta handlers
  const handleToggleMetaNumber = (numberId: string) => {
    setSelectedMetaNumbers(prev =>
      prev.includes(numberId)
        ? prev.filter(id => id !== numberId)
        : [...prev, numberId]
    );
  };

  const handleToggleAllMeta = (checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setAllMetaSelected(isChecked);
    if (isChecked) {
      setSelectedMetaNumbers([]);
    } else {
      setSelectedMetaNumbers(activeMetaNumbers.map(n => n.id));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateMemberInstances.mutateAsync({
          memberId: member.id,
          instanceIds: allInstancesSelected ? [] : selectedInstances,
        }),
        updateMemberMetaNumbers.mutateAsync({
          memberId: member.id,
          metaNumberIds: allMetaSelected ? [] : selectedMetaNumbers,
        }),
      ]);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = isLoadingInstances || isLoadingMemberInstances || isLoadingMetaNumbers || isLoadingMemberMeta;
  const canSaveEvolution = allInstancesSelected || selectedInstances.length > 0;
  const canSaveMeta = allMetaSelected || selectedMetaNumbers.length > 0 || activeMetaNumbers.length === 0;
  const canSave = canSaveEvolution && canSaveMeta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Instâncias de Acesso
          </DialogTitle>
          <DialogDescription>
            Configure quais instâncias {member.profile?.full_name || member.email} pode acessar no inbox.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[55vh] pr-2">
            <div className="space-y-6">
              {/* Evolution Section */}
              {hasEvolutionInstances && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">WhatsApp Lite (Evolution)</h4>
                    <Badge variant="outline" className="text-xs">Lite</Badge>
                  </div>

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
                    <div className="space-y-2 pl-1">
                      {instances.map((instance) => (
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
                    </div>
                  )}
                </div>
              )}

              {/* Separator */}
              {hasEvolutionInstances && hasMetaNumbers && (
                <div className="border-t" />
              )}

              {/* Meta Section */}
              {hasMetaNumbers && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">WhatsApp Business (Meta)</h4>
                    <Badge variant="outline" className="text-xs">API</Badge>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                    <Checkbox
                      id="all-meta-numbers"
                      checked={allMetaSelected}
                      onCheckedChange={handleToggleAllMeta}
                    />
                    <label 
                      htmlFor="all-meta-numbers" 
                      className="flex items-center gap-2 text-sm font-medium cursor-pointer flex-1"
                    >
                      <Globe className="h-4 w-4 text-primary" />
                      Todos os números
                      <Badge variant="secondary" className="ml-auto">Sem restrição</Badge>
                    </label>
                  </div>

                  {!allMetaSelected && (
                    <div className="space-y-2 pl-1">
                      {activeMetaNumbers.map((number) => (
                        <div
                          key={number.id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`meta-${number.id}`}
                            checked={selectedMetaNumbers.includes(number.id)}
                            onCheckedChange={() => handleToggleMetaNumber(number.id)}
                          />
                          <label
                            htmlFor={`meta-${number.id}`}
                            className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                          >
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-medium">{number.display_name || number.phone_number || number.phone_number_id}</span>
                              {number.phone_number && number.display_name && (
                                <span className="text-xs text-muted-foreground">{number.phone_number}</span>
                              )}
                            </div>
                            <Badge
                              variant={number.status === 'connected' ? 'default' : 'secondary'}
                              className="ml-auto"
                            >
                              {number.status === 'connected' ? 'Conectado' : number.status || 'Pendente'}
                            </Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!hasEvolutionInstances && !hasMetaNumbers && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma instância encontrada
                </p>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!canSave || isSaving}
          >
            {isSaving ? (
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
