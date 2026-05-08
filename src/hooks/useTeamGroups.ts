import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { PermissionKey } from '@/config/permissions';
import { toast } from 'sonner';

export interface TeamGroup {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  member_count?: number;
  instance_ids?: string[];
  meta_number_ids?: string[];
}

export interface TeamGroupInput {
  name: string;
  description?: string | null;
  permissions: Record<PermissionKey, boolean>;
  instance_ids: string[];
  meta_number_ids: string[];
}

export function useTeamGroups() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['team-groups', organization?.id],
    queryFn: async () => {
      if (!organization) return [];
      const { data: rows, error } = await supabase
        .from('team_groups')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name', { ascending: true });
      if (error) throw error;

      const ids = (rows || []).map((r) => r.id);
      if (ids.length === 0) return [] as TeamGroup[];

      const [{ data: insts }, { data: metas }, { data: members }] = await Promise.all([
        supabase.from('team_group_instances').select('team_group_id, instance_id').in('team_group_id', ids),
        supabase.from('team_group_meta_numbers').select('team_group_id, meta_number_id').in('team_group_id', ids),
        supabase.from('team_members').select('id, team_group_id').in('team_group_id', ids),
      ]);

      const instMap = new Map<string, string[]>();
      insts?.forEach((r) => {
        const arr = instMap.get(r.team_group_id) ?? [];
        arr.push(r.instance_id);
        instMap.set(r.team_group_id, arr);
      });
      const metaMap = new Map<string, string[]>();
      metas?.forEach((r) => {
        const arr = metaMap.get(r.team_group_id) ?? [];
        arr.push(r.meta_number_id);
        metaMap.set(r.team_group_id, arr);
      });
      const countMap = new Map<string, number>();
      members?.forEach((m) => {
        if (m.team_group_id) countMap.set(m.team_group_id, (countMap.get(m.team_group_id) ?? 0) + 1);
      });

      return (rows as any[]).map((r) => ({
        ...r,
        instance_ids: instMap.get(r.id) ?? [],
        meta_number_ids: metaMap.get(r.id) ?? [],
        member_count: countMap.get(r.id) ?? 0,
      })) as TeamGroup[];
    },
    enabled: !!organization,
  });

  const createGroup = useMutation({
    mutationFn: async (input: TeamGroupInput) => {
      if (!organization) throw new Error('Organização não encontrada');
      const { data, error } = await supabase
        .from('team_groups')
        .insert({
          organization_id: organization.id,
          name: input.name,
          description: input.description ?? null,
          permissions: input.permissions,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.instance_ids.length > 0) {
        await supabase.from('team_group_instances').insert(
          input.instance_ids.map((instance_id) => ({ team_group_id: data.id, instance_id }))
        );
      }
      if (input.meta_number_ids.length > 0) {
        await supabase.from('team_group_meta_numbers').insert(
          input.meta_number_ids.map((meta_number_id) => ({ team_group_id: data.id, meta_number_id }))
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-groups'] });
      toast.success('Equipe criada com sucesso!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TeamGroupInput }) => {
      const { error } = await supabase
        .from('team_groups')
        .update({
          name: input.name,
          description: input.description ?? null,
          permissions: input.permissions,
        })
        .eq('id', id);
      if (error) throw error;

      // Replace instance assignments
      await supabase.from('team_group_instances').delete().eq('team_group_id', id);
      if (input.instance_ids.length > 0) {
        await supabase.from('team_group_instances').insert(
          input.instance_ids.map((instance_id) => ({ team_group_id: id, instance_id }))
        );
      }

      // Replace meta number assignments
      await supabase.from('team_group_meta_numbers').delete().eq('team_group_id', id);
      if (input.meta_number_ids.length > 0) {
        await supabase.from('team_group_meta_numbers').insert(
          input.meta_number_ids.map((meta_number_id) => ({ team_group_id: id, meta_number_id }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-groups'] });
      toast.success('Equipe atualizada!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-groups'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Equipe removida');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyToMember = useMutation({
    mutationFn: async ({ memberId, groupId }: { memberId: string; groupId: string | null }) => {
      const { error } = await supabase.rpc('apply_team_group_to_member', {
        _member_id: memberId,
        _group_id: groupId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['member-instances'] });
      queryClient.invalidateQueries({ queryKey: ['member-meta-numbers'] });
      toast.success('Equipe aplicada ao membro');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resyncMembers = useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await supabase.rpc('resync_team_group_members', { _group_id: groupId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['member-instances'] });
      queryClient.invalidateQueries({ queryKey: ['member-meta-numbers'] });
      toast.success(`${count} membro(s) re-sincronizado(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { groups, isLoading, createGroup, updateGroup, deleteGroup, applyToMember, resyncMembers };
}
