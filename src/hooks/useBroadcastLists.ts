import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface FilterCriteria {
  tags?: string[];
  status?: string;
  optedOut?: boolean;
}

export interface BroadcastList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: "manual" | "dynamic";
  filter_criteria: FilterCriteria;
  created_at: string;
  updated_at: string;
}

export interface BroadcastListContact {
  id: string;
  list_id: string;
  contact_id: string;
  added_at: string;
}

export interface BroadcastSend {
  id: string;
  list_id: string;
  user_id: string;
  message: string;
  total_contacts: number;
  delivered: number;
  failed: number;
  status: string;
  sent_at: string;
  completed_at: string | null;
}

export interface BroadcastListWithContacts extends BroadcastList {
  contact_count: number;
}

export const useBroadcastLists = () => {
  const queryClient = useQueryClient();

  // Fetch all broadcast lists with contact counts
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["broadcast-lists"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: lists, error } = await supabase
        .from("broadcast_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get contact counts for each list
      const listsWithCounts: BroadcastListWithContacts[] = await Promise.all(
        (lists || []).map(async (list) => {
          if (list.type === "manual") {
            const { count } = await supabase
              .from("broadcast_list_contacts")
              .select("*", { count: "exact", head: true })
              .eq("list_id", list.id);
            return { 
              ...list, 
              type: list.type as "manual" | "dynamic",
              filter_criteria: (list.filter_criteria || {}) as FilterCriteria,
              contact_count: count || 0 
            };
          } else {
            // For dynamic lists, count based on filter criteria
            const criteria = (list.filter_criteria || {}) as FilterCriteria;
            
            // If tags are defined, filter by tags first
            if (criteria.tags && criteria.tags.length > 0) {
              const { data: taggedContacts } = await supabase
                .from("contact_tags")
                .select("contact_id")
                .in("tag_id", criteria.tags);

              if (!taggedContacts || taggedContacts.length === 0) {
                return { 
                  ...list, 
                  type: list.type as "manual" | "dynamic",
                  filter_criteria: criteria,
                  contact_count: 0 
                };
              }

              const contactIds = [...new Set(taggedContacts.map(tc => tc.contact_id))];
              
              let query = supabase
                .from("contacts")
                .select("*", { count: "exact", head: true })
                .in("id", contactIds);

              if (criteria.status) {
                query = query.eq("status", criteria.status);
              }
              if (criteria.optedOut !== undefined) {
                query = query.eq("opted_out", criteria.optedOut);
              }

              const { count } = await query;
              return { 
                ...list, 
                type: list.type as "manual" | "dynamic",
                filter_criteria: criteria,
                contact_count: count || 0 
              };
            }
            
            // No tags filter - use original query
            let query = supabase.from("contacts").select("*", { count: "exact", head: true });
            
            if (criteria.status) {
              query = query.eq("status", criteria.status);
            }
            if (criteria.optedOut !== undefined) {
              query = query.eq("opted_out", criteria.optedOut);
            }
            
            const { count } = await query;
            return { 
              ...list, 
              type: list.type as "manual" | "dynamic",
              filter_criteria: criteria,
              contact_count: count || 0 
            };
          }
        })
      );

      return listsWithCounts;
    },
  });

  // Fetch contacts for a specific list
  const useListContacts = (listId: string) => {
    return useQuery({
      queryKey: ["broadcast-list-contacts", listId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("broadcast_list_contacts")
          .select(`
            id,
            contact_id,
            added_at,
            contacts (
              id,
              name,
              phone,
              email,
              status
            )
          `)
          .eq("list_id", listId);

        if (error) throw error;
        return data;
      },
      enabled: !!listId,
    });
  };

  // Fetch send history for a list
  const useListSendHistory = (listId: string) => {
    return useQuery({
      queryKey: ["broadcast-sends", listId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("broadcast_sends")
          .select("*")
          .eq("list_id", listId)
          .order("sent_at", { ascending: false });

        if (error) throw error;
        return data as BroadcastSend[];
      },
      enabled: !!listId,
    });
  };

  // Create a new broadcast list
  const createList = useMutation({
    mutationFn: async (list: {
      name: string;
      description?: string;
      type: "manual" | "dynamic";
      filter_criteria?: FilterCriteria;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("broadcast_lists")
        .insert({
          user_id: user.user.id,
          name: list.name,
          description: list.description,
          type: list.type,
          filter_criteria: (list.filter_criteria || {}) as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      toast.success("Lista criada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar lista", { description: error.message });
    },
  });

  // Update a broadcast list
  const updateList = useMutation({
    mutationFn: async ({
      id,
      filter_criteria,
      ...updates
    }: Partial<BroadcastList> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (filter_criteria !== undefined) {
        updateData.filter_criteria = filter_criteria as Json;
      }
      const { data, error } = await supabase
        .from("broadcast_lists")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      toast.success("Lista atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lista", { description: error.message });
    },
  });

  // Delete a broadcast list
  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("broadcast_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      toast.success("Lista excluída com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir lista", { description: error.message });
    },
  });

  // Add contacts to a manual list
  const addContactsToList = useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const inserts = contactIds.map((contactId) => ({
        list_id: listId,
        contact_id: contactId,
      }));

      const { error } = await supabase
        .from("broadcast_list_contacts")
        .upsert(inserts, { onConflict: "list_id,contact_id" });

      if (error) throw error;
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      queryClient.invalidateQueries({ queryKey: ["broadcast-list-contacts", listId] });
      toast.success("Contatos adicionados com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar contatos", { description: error.message });
    },
  });

  // Remove contacts from a manual list
  const removeContactsFromList = useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const { error } = await supabase
        .from("broadcast_list_contacts")
        .delete()
        .eq("list_id", listId)
        .in("contact_id", contactIds);

      if (error) throw error;
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      queryClient.invalidateQueries({ queryKey: ["broadcast-list-contacts", listId] });
      toast.success("Contatos removidos com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao remover contatos", { description: error.message });
    },
  });

  // Create a broadcast send record
  const createSend = useMutation({
    mutationFn: async ({
      listId,
      message,
      totalContacts,
    }: {
      listId: string;
      message: string;
      totalContacts: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("broadcast_sends")
        .insert({
          list_id: listId,
          user_id: user.user.id,
          message,
          total_contacts: totalContacts,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-sends", listId] });
      toast.success("Envio registrado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao registrar envio", { description: error.message });
    },
  });

  return {
    lists,
    isLoading,
    useListContacts,
    useListSendHistory,
    createList,
    updateList,
    deleteList,
    addContactsToList,
    removeContactsFromList,
    createSend,
  };
};
