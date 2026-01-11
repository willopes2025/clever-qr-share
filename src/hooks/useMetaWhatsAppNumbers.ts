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
  created_at: string;
  updated_at: string;
}

export const useMetaWhatsAppNumbers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: metaNumbers, isLoading } = useQuery({
    queryKey: ['meta-whatsapp-numbers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MetaWhatsAppNumber[];
    },
    enabled: !!user,
  });

  const addNumber = useMutation({
    mutationFn: async ({ phoneNumberId, displayName, phoneNumber }: { 
      phoneNumberId: string; 
      displayName?: string; 
      phoneNumber?: string 
    }) => {
      const { data, error } = await supabase
        .from('meta_whatsapp_numbers')
        .upsert({
          user_id: user!.id,
          phone_number_id: phoneNumberId,
          display_name: displayName || null,
          phone_number: phoneNumber || null,
        }, { onConflict: 'user_id,phone_number_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-whatsapp-numbers'] });
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
      toast.success("Número removido");
    },
  });

  return {
    metaNumbers,
    isLoading,
    addNumber,
    updateNumber,
    deleteNumber,
  };
};
