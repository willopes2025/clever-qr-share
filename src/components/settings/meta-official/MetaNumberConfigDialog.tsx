import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Users, GitBranch } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { MetaWhatsAppNumber } from '@/hooks/useMetaWhatsAppNumbers';

interface MetaNumberConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: MetaWhatsAppNumber;
}

interface Funnel {
  id: string;
  name: string;
}

interface FunnelStage {
  id: string;
  name: string;
  order_index: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  profiles?: { full_name: string | null } | null;
}

export const MetaNumberConfigDialog = ({ open, onOpenChange, number }: MetaNumberConfigDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current config
  const { data: currentConfig } = useQuery({
    queryKey: ['meta-number-config', number.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('default_funnel_id, default_stage_id')
        .eq('id', number.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch assigned members
  const { data: assignedMembers } = useQuery({
    queryKey: ['meta-number-members', number.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_member_meta_numbers' as any)
        .select('team_member_id')
        .eq('meta_number_id', number.id);
      if (error) throw error;
      return (data as any[])?.map((d: any) => d.team_member_id as string) || [];
    },
    enabled: open,
  });

  // Fetch funnels
  const { data: funnels } = useQuery({
    queryKey: ['funnels-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnels')
        .select('id, name')
        .order('created_at');
      if (error) throw error;
      return data as Funnel[];
    },
    enabled: open,
  });

  // Fetch stages for selected funnel
  const { data: stages } = useQuery({
    queryKey: ['funnel-stages', selectedFunnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_stages')
        .select('id, name, order_index')
        .eq('funnel_id', selectedFunnelId!)
        .order('order_index');
      if (error) throw error;
      return data as FunnelStage[];
    },
    enabled: !!selectedFunnelId,
  });

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, user_id, email, role, profiles:user_id(full_name)')
        .eq('status', 'active')
        .order('email');
      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: open,
  });

  // Initialize state when data loads
  useEffect(() => {
    if (currentConfig) {
      setSelectedFunnelId(currentConfig.default_funnel_id || null);
      setSelectedStageId(currentConfig.default_stage_id || null);
    }
  }, [currentConfig]);

  useEffect(() => {
    if (assignedMembers) {
      setSelectedMemberIds(assignedMembers);
    }
  }, [assignedMembers]);

  // Reset stage when funnel changes
  useEffect(() => {
    if (selectedFunnelId !== currentConfig?.default_funnel_id) {
      setSelectedStageId(null);
    }
  }, [selectedFunnelId]);

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update funnel config
      const { error: updateError } = await supabase
        .from('meta_whatsapp_numbers')
        .update({
          default_funnel_id: selectedFunnelId,
          default_stage_id: selectedStageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', number.id);

      if (updateError) throw updateError;

      // Update member assignments
      await supabase
        .from('team_member_meta_numbers' as any)
        .delete()
        .eq('meta_number_id', number.id);

      if (selectedMemberIds.length > 0) {
        const { error: insertError } = await supabase
          .from('team_member_meta_numbers' as any)
          .insert(
            selectedMemberIds.map(memberId => ({
              team_member_id: memberId,
              meta_number_id: number.id,
            }))
          );
        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ['meta-number-config'] });
      queryClient.invalidateQueries({ queryKey: ['meta-number-members'] });
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers'] });
      toast.success('Configuração salva com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getMemberDisplayName = (member: TeamMember) => {
    const profile = member.profiles as any;
    return profile?.full_name || member.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configurar {number.display_name || number.phone_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Funnel Assignment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Funil Padrão</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Leads recebidos por este número serão automaticamente roteados para o funil e etapa selecionados.
            </p>
            <Select
              value={selectedFunnelId || 'none'}
              onValueChange={(v) => setSelectedFunnelId(v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar funil..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum funil</SelectItem>
                {funnels?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedFunnelId && stages && stages.length > 0 && (
              <Select
                value={selectedStageId || 'none'}
                onValueChange={(v) => setSelectedStageId(v === 'none' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar etapa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Primeira etapa (padrão)</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Member Assignment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Membros com Acesso</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione quais membros da equipe podem utilizar este número. Se nenhum for selecionado, todos terão acesso.
            </p>

            {teamMembers && teamMembers.length > 0 ? (
              <ScrollArea className="h-[180px] rounded-md border p-3">
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedMemberIds.includes(member.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggleMember(member.id)}
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onCheckedChange={() => handleToggleMember(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getMemberDisplayName(member)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum membro da equipe encontrado.
              </p>
            )}

            {selectedMemberIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedMemberIds.length} membro{selectedMemberIds.length > 1 ? 's' : ''} selecionado{selectedMemberIds.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
