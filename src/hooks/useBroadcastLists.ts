import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type CustomFieldOperator = 'equals' | 'contains' | 'not_empty' | 'empty';

export interface CustomFieldFilter {
  operator: CustomFieldOperator;
  value?: string;
  // Onde o campo está armazenado quando a fonte é "funnel":
  // - 'lead'    → funnel_deals.custom_fields (default)
  // - 'contact' → contacts.custom_fields (via join)
  entity?: 'lead' | 'contact';
}

export interface FilterCriteria {
  // Campos existentes
  tags?: string[];
  status?: string;
  optedOut?: boolean;
  asaasPaymentStatus?: 'overdue' | 'pending' | 'current';
  asaasDueDateFrom?: string;
  asaasDueDateTo?: string;

  // Filtros avançados
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

const PAGE_SIZE = 1000;
const ASAAS_SYNC_DEDUP_TTL_MS = 2 * 60 * 1000;
const asaasSyncInFlight = new Map<string, Promise<void>>();
const asaasSyncLastRun = new Map<string, number>();

const getAsaasSyncCriteriaKey = (criteria?: FilterCriteria) => {
  const dueDateFrom = criteria?.asaasDueDateFrom?.slice(0, 10) || "";
  const dueDateTo = criteria?.asaasDueDateTo?.slice(0, 10) || "";
  return [criteria?.asaasPaymentStatus || "none", dueDateFrom, dueDateTo].join("|");
};

// =====================================================
// Helpers compartilhados (paginação + filtros JSONB)
// =====================================================

/**
 * Aplica filtros de campo personalizado a uma query.
 * @param column Coluna JSONB alvo (ex: 'custom_fields' ou 'contacts.custom_fields')
 * @param entityFilter Se definido, aplica somente filtros cuja entity bate (default: aplica a tudo)
 */
const applyCustomFieldFilters = <T extends { eq: Function; ilike: Function; not: Function; is: Function }>(
  query: T,
  customFields: Record<string, CustomFieldFilter> | undefined,
  column: string,
  entityFilter?: 'lead' | 'contact',
): T => {
  if (!customFields) return query;

  let q: any = query;
  Object.entries(customFields).forEach(([fieldKey, filter]) => {
    // Quando há entityFilter (modo funnel), pula filtros da outra entidade
    if (entityFilter) {
      const fieldEntity = filter.entity ?? 'lead'; // default lead em modo funnel
      if (fieldEntity !== entityFilter) return;
    }

    // Sintaxe PostgREST: column->>"key" — aspas garantem suporte a hífens etc.
    const path = `${column}->>${fieldKey}`;

    if (filter.operator === 'equals' && filter.value !== undefined && filter.value !== '') {
      q = q.eq(path, filter.value);
    } else if (filter.operator === 'contains' && filter.value !== undefined && filter.value !== '') {
      q = q.ilike(path, `%${filter.value}%`);
    } else if (filter.operator === 'not_empty') {
      q = q.not(path, 'is', null);
    } else if (filter.operator === 'empty') {
      q = q.is(path, null);
    }
  });
  return q as T;
};

/** Pagina uma query Supabase em lotes de PAGE_SIZE retornando todos os registros. */
const fetchAllPages = async <T,>(buildQuery: () => any): Promise<T[]> => {
  const all: T[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return all;
};

export const useBroadcastLists = () => {
  const queryClient = useQueryClient();

  const syncAsaasContactsForCriteria = async (criteria?: FilterCriteria) => {
    if (!criteria?.asaasPaymentStatus) return;

    const syncKey = getAsaasSyncCriteriaKey(criteria);
    const lastRunAt = asaasSyncLastRun.get(syncKey);
    const now = Date.now();
    if (lastRunAt && now - lastRunAt < ASAAS_SYNC_DEDUP_TTL_MS) return;

    const inFlightSync = asaasSyncInFlight.get(syncKey);
    if (inFlightSync) {
      await inFlightSync;
      return;
    }

    const dueDateFrom = criteria.asaasDueDateFrom?.slice(0, 10);
    const dueDateTo = criteria.asaasDueDateTo?.slice(0, 10);

    const syncPromise = (async () => {
      const syncBody: Record<string, string> = {};
      if (dueDateFrom) syncBody.dueDateFrom = dueDateFrom;
      if (dueDateTo) syncBody.dueDateTo = dueDateTo;
      const { error } = await supabase.functions.invoke('sync-asaas-contacts', {
        body: Object.keys(syncBody).length > 0 ? syncBody : undefined,
      });
      if (error) throw error;
      asaasSyncLastRun.set(syncKey, Date.now());
    })();

    asaasSyncInFlight.set(syncKey, syncPromise);
    try {
      await syncPromise;
    } finally {
      asaasSyncInFlight.delete(syncKey);
    }
  };

  // ===========================================================
  // CONTAGEM
  // ===========================================================
  const countContactsByCriteria = async (criteria: FilterCriteria): Promise<number> => {
    // ---------- FONTE: FUNIL ----------
    if (criteria.source === 'funnel' && criteria.funnelId) {
      // Para garantir paridade com a listagem, paginamos os deals e
      // contamos contact_ids únicos (um contato pode ter múltiplos deals).
      const needsContactJoin =
        criteria.optedOut !== undefined ||
        (criteria.tags && criteria.tags.length > 0) ||
        Object.values(criteria.customFields ?? {}).some(f => f.entity === 'contact') ||
        !!criteria.asaasPaymentStatus;

      const select = needsContactJoin
        ? 'contact_id, contacts!inner(id, opted_out, asaas_payment_status, custom_fields)'
        : 'contact_id';

      let buildQuery = () => {
        let q: any = supabase
          .from('funnel_deals')
          .select(select)
          .eq('funnel_id', criteria.funnelId!);

        if (criteria.stageId && criteria.stageId !== 'all') {
          q = q.eq('stage_id', criteria.stageId);
        }

        // Filtros do contato (via join)
        if (needsContactJoin) {
          if (criteria.optedOut !== undefined) {
            q = q.eq('contacts.opted_out', criteria.optedOut);
          }
          if (criteria.asaasPaymentStatus) {
            q = q.eq('contacts.asaas_payment_status', criteria.asaasPaymentStatus);
          }
          // Custom fields do contato
          q = applyCustomFieldFilters(q, criteria.customFields, 'contacts.custom_fields', 'contact');
        }

        // Custom fields do lead (no próprio deal)
        q = applyCustomFieldFilters(q, criteria.customFields, 'custom_fields', 'lead');

        return q;
      };

      const rows = await fetchAllPages<{ contact_id: string }>(buildQuery);
      let contactIds = new Set(rows.map(r => r.contact_id));

      // Filtro de tags (separado: requer um lookup adicional)
      if (criteria.tags && criteria.tags.length > 0 && contactIds.size > 0) {
        const ids = Array.from(contactIds);
        const tagged = new Set<string>();
        // Paginar por blocos de 1000 contact_ids para evitar limite do .in()
        for (let i = 0; i < ids.length; i += PAGE_SIZE) {
          const slice = ids.slice(i, i + PAGE_SIZE);
          const { data, error } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('contact_id', slice)
            .in('tag_id', criteria.tags);
          if (error) throw error;
          (data ?? []).forEach(r => tagged.add(r.contact_id));
        }
        contactIds = new Set(Array.from(contactIds).filter(id => tagged.has(id)));
      }

      return contactIds.size;
    }

    // ---------- FONTE: CONTATOS ----------
    // Quando há tags, usamos inner join para evitar limite do .in() em listas grandes
    if (criteria.tags && criteria.tags.length > 0) {
      let buildQuery = () => {
        let q: any = supabase
          .from('contacts')
          .select('id, contact_tags!inner(tag_id)')
          .in('contact_tags.tag_id', criteria.tags!);

        if (criteria.status) q = q.eq('status', criteria.status);
        if (criteria.optedOut !== undefined) q = q.eq('opted_out', criteria.optedOut);
        if (criteria.asaasPaymentStatus) q = q.eq('asaas_payment_status', criteria.asaasPaymentStatus);
        q = applyCustomFieldFilters(q, criteria.customFields, 'custom_fields');
        return q;
      };

      const rows = await fetchAllPages<{ id: string }>(buildQuery);
      const unique = new Set(rows.map(r => r.id));
      return unique.size;
    }

    // Sem tags: contagem direta via head
    let q: any = supabase.from('contacts').select('*', { count: 'exact', head: true });
    if (criteria.status) q = q.eq('status', criteria.status);
    if (criteria.optedOut !== undefined) q = q.eq('opted_out', criteria.optedOut);
    if (criteria.asaasPaymentStatus) q = q.eq('asaas_payment_status', criteria.asaasPaymentStatus);
    q = applyCustomFieldFilters(q, criteria.customFields, 'custom_fields');

    const { count } = await q;
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
      if (!lists || lists.length === 0) return [];

      const manualListIds = lists.filter(l => l.type === "manual").map(l => l.id);

      let manualCountMap = new Map<string, number>();
      if (manualListIds.length > 0) {
        const { data: countData } = await supabase
          .from("broadcast_list_contacts")
          .select("list_id", { count: "exact", head: false })
          .in("list_id", manualListIds);

        if (countData) {
          for (const row of countData) {
            manualCountMap.set(row.list_id, (manualCountMap.get(row.list_id) || 0) + 1);
          }
        }
      }

      const dynamicLists = lists.filter(l => l.type === "dynamic");

      const dynamicCountMap = new Map<string, number>();
      if (dynamicLists.length > 0) {
        const countPromises = dynamicLists.map(async (list) => {
          const criteria = (list.filter_criteria || {}) as FilterCriteria;
          try {
            const count = await countContactsByCriteria(criteria);
            return { id: list.id, count };
          } catch (err) {
            console.error('[BroadcastLists] count failed for list', list.id, err);
            return { id: list.id, count: 0 };
          }
        });
        const counts = await Promise.all(countPromises);
        counts.forEach(({ id, count }) => dynamicCountMap.set(id, count));
      }

      const listsWithCounts: BroadcastListWithContacts[] = lists.map(list => {
        const criteria = (list.filter_criteria || {}) as FilterCriteria;
        const contactCount = list.type === "manual"
          ? (manualCountMap.get(list.id) || 0)
          : (dynamicCountMap.get(list.id) || 0);

        return {
          ...list,
          type: list.type as "manual" | "dynamic",
          filter_criteria: criteria,
          contact_count: contactCount,
        };
      });

      return listsWithCounts;
    },
  });

  // ===========================================================
  // LISTAGEM
  // ===========================================================
  const useListContacts = (listId: string, listType?: "manual" | "dynamic", filterCriteria?: FilterCriteria) => {
    return useQuery({
      queryKey: ["broadcast-list-contacts", listId, listType, JSON.stringify(filterCriteria ?? {})],
      queryFn: async () => {
        if (listType === "dynamic") {
          // Trigger Asaas sync if needed
          if (filterCriteria?.asaasPaymentStatus) {
            try {
              await syncAsaasContactsForCriteria(filterCriteria);
            } catch (syncError) {
              console.error('[BroadcastList] Asaas sync failed:', syncError);
            }
          }

          // ---------- FONTE: FUNIL ----------
          if (filterCriteria?.source === 'funnel' && filterCriteria?.funnelId) {
            type DealRow = {
              contact_id: string;
              contacts: {
                id: string;
                name: string | null;
                phone: string;
                email: string | null;
                status: string;
                opted_out?: boolean | null;
              };
            };

            // Sempre usamos inner join com contatos pra retornar nome/telefone/etc.
            const buildQuery = () => {
              let q: any = supabase
                .from('funnel_deals')
                .select('contact_id, contacts!inner(id, name, phone, email, status, opted_out, asaas_payment_status, custom_fields)')
                .eq('funnel_id', filterCriteria.funnelId!);

              if (filterCriteria.stageId && filterCriteria.stageId !== 'all') {
                q = q.eq('stage_id', filterCriteria.stageId);
              }

              // Filtros do contato (via join)
              if (filterCriteria.optedOut !== undefined) {
                q = q.eq('contacts.opted_out', filterCriteria.optedOut);
              }
              if (filterCriteria.asaasPaymentStatus) {
                q = q.eq('contacts.asaas_payment_status', filterCriteria.asaasPaymentStatus);
              }
              q = applyCustomFieldFilters(q, filterCriteria.customFields, 'contacts.custom_fields', 'contact');

              // Custom fields do lead (no próprio deal)
              q = applyCustomFieldFilters(q, filterCriteria.customFields, 'custom_fields', 'lead');

              return q;
            };

            const rows = await fetchAllPages<DealRow>(buildQuery);

            // Deduplicar contatos
            let uniqueContactsMap = new Map<string, DealRow['contacts']>();
            for (const r of rows) {
              if (!uniqueContactsMap.has(r.contact_id) && r.contacts) {
                uniqueContactsMap.set(r.contact_id, r.contacts);
              }
            }

            // Filtro de tags em lote
            if (filterCriteria.tags && filterCriteria.tags.length > 0 && uniqueContactsMap.size > 0) {
              const ids = Array.from(uniqueContactsMap.keys());
              const tagged = new Set<string>();
              for (let i = 0; i < ids.length; i += PAGE_SIZE) {
                const slice = ids.slice(i, i + PAGE_SIZE);
                const { data, error } = await supabase
                  .from('contact_tags')
                  .select('contact_id')
                  .in('contact_id', slice)
                  .in('tag_id', filterCriteria.tags);
                if (error) throw error;
                (data ?? []).forEach(r => tagged.add(r.contact_id));
              }
              uniqueContactsMap = new Map(
                Array.from(uniqueContactsMap.entries()).filter(([id]) => tagged.has(id))
              );
            }

            return Array.from(uniqueContactsMap.values()).map((contact) => ({
              id: contact.id,
              contact_id: contact.id,
              added_at: new Date().toISOString(),
              contacts: {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                status: contact.status,
              },
            }));
          }

          // ---------- FONTE: CONTATOS COM TAGS ----------
          if (filterCriteria?.tags && filterCriteria.tags.length > 0) {
            const buildQuery = () => {
              let q: any = supabase
                .from('contacts')
                .select('id, name, phone, email, status, custom_fields, contact_tags!inner(tag_id)')
                .in('contact_tags.tag_id', filterCriteria.tags!);

              if (filterCriteria.status) q = q.eq('status', filterCriteria.status);
              if (filterCriteria.optedOut !== undefined) q = q.eq('opted_out', filterCriteria.optedOut);
              if (filterCriteria.asaasPaymentStatus) q = q.eq('asaas_payment_status', filterCriteria.asaasPaymentStatus);
              q = applyCustomFieldFilters(q, filterCriteria.customFields, 'custom_fields');
              return q;
            };

            const rows = await fetchAllPages<any>(buildQuery);
            const uniqueContacts = Array.from(new Map(rows.map(c => [c.id, c])).values());

            return uniqueContacts.map((contact) => ({
              id: contact.id,
              contact_id: contact.id,
              added_at: new Date().toISOString(),
              contacts: {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                status: contact.status,
              },
            }));
          }

          // ---------- FONTE: CONTATOS SEM TAGS ----------
          const buildQuery = () => {
            let q: any = supabase.from('contacts').select('id, name, phone, email, status, custom_fields');
            if (filterCriteria?.status) q = q.eq('status', filterCriteria.status);
            if (filterCriteria?.optedOut !== undefined) q = q.eq('opted_out', filterCriteria.optedOut);
            if (filterCriteria?.asaasPaymentStatus) q = q.eq('asaas_payment_status', filterCriteria.asaasPaymentStatus);
            q = applyCustomFieldFilters(q, filterCriteria?.customFields, 'custom_fields');
            return q;
          };

          const allFilteredContacts = await fetchAllPages<any>(buildQuery);

          return allFilteredContacts.map((contact) => ({
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
