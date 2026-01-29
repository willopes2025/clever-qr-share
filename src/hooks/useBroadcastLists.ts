import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type CustomFieldOperator = 'equals' | 'contains' | 'not_empty' | 'empty';

export interface CustomFieldFilter {
  operator: CustomFieldOperator;
  value?: string;
}

export interface FilterCriteria {
  // Campos existentes
  tags?: string[];
  status?: string;
  optedOut?: boolean;
  asaasPaymentStatus?: 'overdue' | 'pending' | 'current';
  
  // Novos campos para filtros avançados
  source?: 'contacts' | 'funnel';
  funnelId?: string;
  stageId?: string;
  customFields?: Record<string, CustomFieldFilter>;
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

  // Helper para contar contatos baseado nos critérios de filtro
  const countContactsByCriteria = async (criteria: FilterCriteria): Promise<number> => {
    // Se fonte é funil, buscar contatos via funnel_deals
    if (criteria.source === 'funnel' && criteria.funnelId) {
      let query = supabase
        .from('funnel_deals')
        .select('contact_id', { count: 'exact', head: true })
        .eq('funnel_id', criteria.funnelId);
      
      if (criteria.stageId && criteria.stageId !== 'all') {
        query = query.eq('stage_id', criteria.stageId);
      }
      
      // Para filtros de funil, aplicamos filtros de customFields do deal
      if (criteria.customFields) {
        Object.entries(criteria.customFields).forEach(([fieldKey, filter]) => {
          if (filter.operator === 'equals' && filter.value) {
            query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
          } else if (filter.operator === 'contains' && filter.value) {
            query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
          } else if (filter.operator === 'not_empty') {
            query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
          } else if (filter.operator === 'empty') {
            query = query.is(`custom_fields->>${fieldKey}`, null);
          }
        });
      }
      
      const { count } = await query;
      return count || 0;
    }
    
    // Fonte é contatos - lógica original expandida
    // Se tags são definidas, usar inner join
    if (criteria.tags && criteria.tags.length > 0) {
      let query = supabase
        .from("contacts")
        .select("id, contact_tags!inner(tag_id)", { count: "exact", head: true })
        .in("contact_tags.tag_id", criteria.tags);

      if (criteria.status) {
        query = query.eq("status", criteria.status);
      }
      if (criteria.optedOut !== undefined) {
        query = query.eq("opted_out", criteria.optedOut);
      }
      
      // Filtros de campos dinâmicos para contatos
      if (criteria.customFields) {
        Object.entries(criteria.customFields).forEach(([fieldKey, filter]) => {
          if (filter.operator === 'equals' && filter.value) {
            query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
          } else if (filter.operator === 'contains' && filter.value) {
            query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
          } else if (filter.operator === 'not_empty') {
            query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
          } else if (filter.operator === 'empty') {
            query = query.is(`custom_fields->>${fieldKey}`, null);
          }
        });
      }

      const { count } = await query;
      return count || 0;
    }
    
    // Sem tags - usar query padrão
    let query = supabase.from("contacts").select("*", { count: "exact", head: true });
    
    if (criteria.status) {
      query = query.eq("status", criteria.status);
    }
    if (criteria.optedOut !== undefined) {
      query = query.eq("opted_out", criteria.optedOut);
    }
    if (criteria.asaasPaymentStatus) {
      query = query.eq("asaas_payment_status", criteria.asaasPaymentStatus);
    }
    
    // Filtros de campos dinâmicos para contatos
    if (criteria.customFields) {
      Object.entries(criteria.customFields).forEach(([fieldKey, filter]) => {
        if (filter.operator === 'equals' && filter.value) {
          query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
        } else if (filter.operator === 'contains' && filter.value) {
          query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
        } else if (filter.operator === 'not_empty') {
          query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
        } else if (filter.operator === 'empty') {
          query = query.is(`custom_fields->>${fieldKey}`, null);
        }
      });
    }
    
    const { count } = await query;
    return count || 0;
  };

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
            // Para listas dinâmicas, usar helper de contagem
            const criteria = (list.filter_criteria || {}) as FilterCriteria;
            const contactCount = await countContactsByCriteria(criteria);
            
            return { 
              ...list, 
              type: list.type as "manual" | "dynamic",
              filter_criteria: criteria,
              contact_count: contactCount 
            };
          }
        })
      );

      return listsWithCounts;
    },
  });

  // Fetch contacts for a specific list
  const useListContacts = (listId: string, listType?: "manual" | "dynamic", filterCriteria?: FilterCriteria) => {
    return useQuery({
      queryKey: ["broadcast-list-contacts", listId, listType, JSON.stringify(filterCriteria ?? {})],
      queryFn: async () => {
        if (listType === "dynamic") {
          // Se fonte é funil, buscar contatos via funnel_deals
          if (filterCriteria?.source === 'funnel' && filterCriteria?.funnelId) {
            let query = supabase
              .from('funnel_deals')
              .select('contact_id, contacts!inner(id, name, phone, email, status)')
              .eq('funnel_id', filterCriteria.funnelId);
            
            if (filterCriteria.stageId && filterCriteria.stageId !== 'all') {
              query = query.eq('stage_id', filterCriteria.stageId);
            }
            
            // Filtros de campos dinâmicos do deal
            if (filterCriteria.customFields) {
              Object.entries(filterCriteria.customFields).forEach(([fieldKey, filter]) => {
                if (filter.operator === 'equals' && filter.value) {
                  query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
                } else if (filter.operator === 'contains' && filter.value) {
                  query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
                } else if (filter.operator === 'not_empty') {
                  query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
                } else if (filter.operator === 'empty') {
                  query = query.is(`custom_fields->>${fieldKey}`, null);
                }
              });
            }
            
            // Filtro de tags (aplicado ao contato via join)
            if (filterCriteria.tags && filterCriteria.tags.length > 0) {
              // Precisamos filtrar os resultados após o fetch
              const { data, error } = await query.limit(1000);
              if (error) throw error;
              
              // Buscar tags dos contatos para filtrar
              const contactIds = (data || []).map((d: { contact_id: string }) => d.contact_id);
              if (contactIds.length === 0) return [];
              
              const { data: contactTags } = await supabase
                .from('contact_tags')
                .select('contact_id, tag_id')
                .in('contact_id', contactIds)
                .in('tag_id', filterCriteria.tags);
              
              const contactsWithTags = new Set((contactTags || []).map(ct => ct.contact_id));
              
              const filteredData = (data || []).filter((d: { contact_id: string }) => 
                contactsWithTags.has(d.contact_id)
              );
              
              // Remover duplicatas
              const uniqueContacts = Array.from(
                new Map(filteredData.map((d: { contact_id: string; contacts: { id: string; name: string | null; phone: string; email: string | null; status: string } }) => [d.contact_id, d.contacts])).values()
              );
              
              return uniqueContacts.map((contact) => ({
                id: contact.id,
                contact_id: contact.id,
                added_at: new Date().toISOString(),
                contacts: contact,
              }));
            }
            
            const { data, error } = await query.limit(1000);
            if (error) throw error;
            
            // Remover duplicatas (mesmo contato pode ter múltiplos deals)
            const uniqueContacts = Array.from(
              new Map((data || []).map((d: { contact_id: string; contacts: { id: string; name: string | null; phone: string; email: string | null; status: string } }) => [d.contact_id, d.contacts])).values()
            );
            
            return uniqueContacts.map((contact) => ({
              id: contact.id,
              contact_id: contact.id,
              added_at: new Date().toISOString(),
              contacts: contact,
            }));
          }
          
          // For dynamic lists with tags, use inner join (avoids .in() limit with large lists)
          if (filterCriteria?.tags && filterCriteria.tags.length > 0) {
            let query = supabase
              .from("contacts")
              .select("id, name, phone, email, status, custom_fields, contact_tags!inner(tag_id)")
              .in("contact_tags.tag_id", filterCriteria.tags);

            if (filterCriteria?.status) {
              query = query.eq("status", filterCriteria.status);
            }
            if (filterCriteria?.optedOut !== undefined) {
              query = query.eq("opted_out", filterCriteria.optedOut);
            }
            
            // Filtros de campos dinâmicos
            if (filterCriteria.customFields) {
              Object.entries(filterCriteria.customFields).forEach(([fieldKey, filter]) => {
                if (filter.operator === 'equals' && filter.value) {
                  query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
                } else if (filter.operator === 'contains' && filter.value) {
                  query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
                } else if (filter.operator === 'not_empty') {
                  query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
                } else if (filter.operator === 'empty') {
                  query = query.is(`custom_fields->>${fieldKey}`, null);
                }
              });
            }

            const { data, error } = await query.limit(1000);
            if (error) throw error;

            // Remove duplicates (contact may have multiple matching tags)
            const uniqueContacts = Array.from(
              new Map((data || []).map(c => [c.id, c])).values()
            );

            return uniqueContacts.map((contact) => ({
              id: contact.id,
              contact_id: contact.id,
              added_at: new Date().toISOString(),
              contacts: { id: contact.id, name: contact.name, phone: contact.phone, email: contact.email, status: contact.status },
            }));
          }

          // Dynamic list without tags - use other filters
          let query = supabase.from("contacts").select("id, name, phone, email, status, custom_fields");
          
          if (filterCriteria?.status) {
            query = query.eq("status", filterCriteria.status);
          }
          if (filterCriteria?.optedOut !== undefined) {
            query = query.eq("opted_out", filterCriteria.optedOut);
          }
          if (filterCriteria?.asaasPaymentStatus) {
            query = query.eq("asaas_payment_status", filterCriteria.asaasPaymentStatus);
          }
          
          // Filtros de campos dinâmicos
          if (filterCriteria?.customFields) {
            Object.entries(filterCriteria.customFields).forEach(([fieldKey, filter]) => {
              if (filter.operator === 'equals' && filter.value) {
                query = query.eq(`custom_fields->>${fieldKey}`, filter.value);
              } else if (filter.operator === 'contains' && filter.value) {
                query = query.ilike(`custom_fields->>${fieldKey}`, `%${filter.value}%`);
              } else if (filter.operator === 'not_empty') {
                query = query.not(`custom_fields->>${fieldKey}`, 'is', null);
              } else if (filter.operator === 'empty') {
                query = query.is(`custom_fields->>${fieldKey}`, null);
              }
            });
          }

          const { data, error } = await query.limit(1000);
          if (error) throw error;

          return (data || []).map((contact) => ({
            id: contact.id,
            contact_id: contact.id,
            added_at: new Date().toISOString(),
            contacts: contact,
          }));
        } else {
          // For manual lists, fetch from relationship table
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
        }
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
