import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MetaWhatsAppNumber {
  id: string;
  user_id: string;
  phone_number_id: string;
  display_name: string | null;
  phone_number: string | null;
  is_active: boolean;
  waba_id: string | null;
  business_account_id: string | null;
  quality_rating: string | null;
  messaging_limit: string | null;
  status: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useMetaWhatsAppNumbers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user has meta number restriction
  const { data: myMetaNumberIds } = useQuery({
    queryKey: ['my-meta-number-ids', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_member_meta_number_ids', { _user_id: user!.id });
      if (error) throw error;
      return data as string[];
    },
    enabled: !!user,
  });

  const { data: hasMetaRestriction } = useQuery({
    queryKey: ['has-meta-restriction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('member_has_meta_restriction', { _user_id: user!.id });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });

  // Buscar TODOS os user_ids da organização do usuário logado (owner + membros ativos).
  // Necessário porque o RLS concede ao admin do sistema acesso a TODOS os números —
  // o filtro no frontend garante que cada assinatura veja apenas o que é seu.
  const { data: orgUserIds } = useQuery({
    queryKey: ['my-org-user-ids', user?.id],
    queryFn: async () => {
      const ids = new Set<string>();
      ids.add(user!.id);

      // Organização onde o usuário é membro ativo
      const { data: myMembership } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      let orgId = myMembership?.organization_id as string | undefined;

      // Caso seja owner sem registro em team_members, busca a org dele
      if (!orgId) {
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', user!.id)
          .maybeSingle();
        orgId = ownedOrg?.id;
      }

      if (orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', orgId)
          .maybeSingle();
        if (org?.owner_id) ids.add(org.owner_id);

        const { data: tms } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('status', 'active');
        tms?.forEach(tm => { if (tm.user_id) ids.add(tm.user_id); });
      }

      return Array.from(ids);
    },
    enabled: !!user,
  });

  const { data: metaNumbers, isLoading, refetch } = useQuery({
    queryKey: ['meta-whatsapp-numbers', user?.id, myMetaNumberIds, hasMetaRestriction, orgUserIds],
    queryFn: async () => {
      // Filtro defensivo no servidor: restringe explicitamente aos user_ids da org.
      // Se orgUserIds estiver vazio (caso anômalo), retorna lista vazia em vez de tudo.
      if (!orgUserIds || orgUserIds.length === 0) {
        return [] as MetaWhatsAppNumber[];
      }

      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('*')
        .in('user_id', orgUserIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      let numbers = (data as MetaWhatsAppNumber[]) || [];

      // Defesa em camadas: reaplica filtro local mesmo após .in().
      const orgSet = new Set(orgUserIds);
      numbers = numbers.filter(n => n.user_id && orgSet.has(n.user_id));

      // Se o usuário tiver restrição (membro com números específicos), filtrar adicionalmente
      if (hasMetaRestriction && myMetaNumberIds && myMetaNumberIds.length > 0) {
        numbers = numbers.filter(n => myMetaNumberIds.includes(n.id));
      }
      
      return numbers;
    },
    enabled: !!user && hasMetaRestriction !== undefined && orgUserIds !== undefined,
  });

  const addNumber = useMutation({
    mutationFn: async ({ phoneNumberId, displayName, phoneNumber, wabaId, businessAccountId, qualityRating, messagingLimit }: { 
      phoneNumberId: string; 
      displayName?: string; 
      phoneNumber?: string;
      wabaId?: string;
      businessAccountId?: string;
      qualityRating?: string;
      messagingLimit?: string;
    }) => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .upsert({
          user_id: user!.id,
          phone_number_id: phoneNumberId,
          display_name: displayName || null,
          phone_number: phoneNumber || null,
          waba_id: wabaId || null,
          business_account_id: businessAccountId || null,
          quality_rating: qualityRating || null,
          messaging_limit: messagingLimit || null,
          status: 'connected',
          is_active: true,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'phone_number_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers-map'] });
      queryClient.invalidateQueries({ queryKey: ['my-meta-number-ids'] });
      queryClient.invalidateQueries({ queryKey: ['has-meta-restriction'] });
      toast.success("Número Meta adicionado com sucesso");
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar número: " + error.message);
    },
  });

  const updateNumber = useMutation({
    mutationFn: async ({ id, displayName, phoneNumber, isActive }: { 
      id: string; 
      displayName?: string; 
      phoneNumber?: string;
      isActive?: boolean;
    }) => {
      const { error } = await supabase
        .from('meta_whatsapp_numbers')
        .update({
          display_name: displayName,
          phone_number: phoneNumber,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers-map'] });
    },
  });

  const deleteNumber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_whatsapp_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers-map'] });
      toast.success("Número removido");
    },
  });

  return {
    metaNumbers,
    isLoading,
    refetch,
    addNumber,
    updateNumber,
    deleteNumber,
  };
};
