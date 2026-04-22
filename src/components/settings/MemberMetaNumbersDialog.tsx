import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Loader2, Globe, MessageSquare } from 'lucide-react';
import { TeamMember } from '@/hooks/useOrganization';
import { useMetaWhatsAppNumbers } from '@/hooks/useMetaWhatsAppNumbers';
import { useMemberMetaNumbers } from '@/hooks/useMemberMetaNumbers';

interface MemberMetaNumbersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberMetaNumbersDialog({ open, onOpenChange, member }: MemberMetaNumbersDialogProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [allNumbersSelected, setAllNumbersSelected] = useState(true);
  const hasInitialized = useRef(false);

  const { metaNumbers, isLoading: isLoadingNumbers } = useMetaWhatsAppNumbers();
  const { memberMetaNumberIds, isLoading: isLoadingMember, updateMemberMetaNumbers } = useMemberMetaNumbers(member.id);

  // Resolver user_ids da organização do MEMBRO sendo editado (não do logado).
  // Garante que admins gerenciando outras orgs vejam apenas os números daquela org.
  const { data: orgUserIds, isLoading: isLoadingOrgUsers } = useQuery({
    queryKey: ['member-org-user-ids', member.organization_id],
    queryFn: async () => {
      const ids = new Set<string>();

      const { data: org } = await supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', member.organization_id)
        .maybeSingle();
      if (org?.owner_id) ids.add(org.owner_id);

      const { data: tms } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('organization_id', member.organization_id)
        .eq('status', 'active');
      tms?.forEach(tm => { if (tm.user_id) ids.add(tm.user_id); });

      return Array.from(ids);
    },
    enabled: open && !!member.organization_id,
  });

  const orgUserIdSet = orgUserIds ? new Set(orgUserIds) : null;
  const activeNumbers = (metaNumbers || []).filter(n =>
    n.is_active && (!orgUserIdSet || (n.user_id && orgUserIdSet.has(n.user_id)))
  );

  useEffect(() => {
    if (open && memberMetaNumberIds !== undefined && !hasInitialized.current) {
      hasInitialized.current = true;
      if (memberMetaNumberIds.length === 0) {
        setAllNumbersSelected(true);
        setSelectedNumbers([]);
      } else {
        setAllNumbersSelected(false);
        setSelectedNumbers(memberMetaNumberIds);
      }
    }
    if (!open) {
      hasInitialized.current = false;
    }
  }, [open, memberMetaNumberIds]);

  const handleToggleNumber = (numberId: string) => {
    setSelectedNumbers(prev =>
      prev.includes(numberId)
        ? prev.filter(id => id !== numberId)
        : [...prev, numberId]
    );
  };

  const handleToggleAllNumbers = (checked: boolean | 'indeterminate') => {
    const isChecked = checked === true;
    setAllNumbersSelected(isChecked);
    if (isChecked) {
      setSelectedNumbers([]);
    } else {
      setSelectedNumbers(activeNumbers.map(n => n.id));
    }
  };

  const handleSave = async () => {
    await updateMemberMetaNumbers.mutateAsync({
      memberId: member.id,
      metaNumberIds: allNumbersSelected ? [] : selectedNumbers,
    });
    onOpenChange(false);
  };

  const isLoading = isLoadingNumbers || isLoadingMember;
  const canSave = allNumbersSelected || selectedNumbers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Números Meta (Oficial)
          </DialogTitle>
          <DialogDescription>
            Selecione quais números oficiais do WhatsApp (Meta) {member.profile?.full_name || member.email} pode acessar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="all-meta-numbers"
                checked={allNumbersSelected}
                onCheckedChange={handleToggleAllNumbers}
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

            {!allNumbersSelected && (
              <>
                <p className="text-sm text-muted-foreground">
                  Ou selecione números específicos:
                </p>

                <ScrollArea className="h-[250px] rounded-lg border p-3">
                  <div className="space-y-2">
                    {activeNumbers.map((number) => (
                      <div
                        key={number.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={`meta-${number.id}`}
                          checked={selectedNumbers.includes(number.id)}
                          onCheckedChange={() => handleToggleNumber(number.id)}
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

                    {activeNumbers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum número Meta encontrado
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
            disabled={!canSave || updateMemberMetaNumbers.isPending}
          >
            {updateMemberMetaNumbers.isPending ? (
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
