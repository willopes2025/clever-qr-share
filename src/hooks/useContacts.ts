import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Contact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  custom_fields: Record<string, string>;
  status: string;
  opted_out: boolean;
  opted_out_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactWithTags extends Contact {
  contact_tags: { tag_id: string; tags: Tag }[];
}

export const useContacts = () => {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          contact_tags (
            tag_id,
            tags (*)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContactWithTags[];
    },
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Tag[];
    },
  });

  const createContact = useMutation({
    mutationFn: async (contact: {
      phone: string;
      name?: string;
      email?: string;
      notes?: string;
      custom_fields?: Record<string, string>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // Normalize phone number
      const normalizedPhone = contact.phone.replace(/\D/g, "");

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          ...contact,
          phone: normalizedPhone,
          user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contato criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar contato",
        description: error.message.includes("unique_phone_per_user")
          ? "Este número já está cadastrado"
          : error.message,
        variant: "destructive",
      });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contato atualizado!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contato excluído!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMultipleContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contacts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contatos excluídos!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir contatos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importContacts = useMutation({
    mutationFn: async (
      contacts: { phone: string; name?: string; email?: string }[]
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const normalizedContacts = contacts.map((c) => ({
        ...c,
        phone: c.phone.replace(/\D/g, ""),
        user_id: userData.user!.id,
      }));

      const { data, error } = await supabase
        .from("contacts")
        .upsert(normalizedContacts, {
          onConflict: "user_id,phone",
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: `${data.length} contatos importados!` });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao importar contatos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleOptOut = useMutation({
    mutationFn: async ({ id, opted_out }: { id: string; opted_out: boolean }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update({
          opted_out,
          opted_out_at: opted_out ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: data.opted_out
          ? "Contato adicionado à blacklist"
          : "Contato removido da blacklist",
      });
    },
  });

  // Tag operations
  const createTag = useMutation({
    mutationFn: async (tag: { name: string; color: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("tags")
        .insert({ ...tag, user_id: userData.user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast({ title: "Tag criada!" });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Tag excluída!" });
    },
  });

  const addTagToContact = useMutation({
    mutationFn: async ({
      contactId,
      tagId,
    }: {
      contactId: string;
      tagId: string;
    }) => {
      const { error } = await supabase
        .from("contact_tags")
        .insert({ contact_id: contactId, tag_id: tagId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const removeTagFromContact = useMutation({
    mutationFn: async ({
      contactId,
      tagId,
    }: {
      contactId: string;
      tagId: string;
    }) => {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag_id", tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    contacts,
    tags,
    isLoading,
    tagsLoading,
    refetch,
    createContact,
    updateContact,
    deleteContact,
    deleteMultipleContacts,
    importContacts,
    toggleOptOut,
    createTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,
  };
};
