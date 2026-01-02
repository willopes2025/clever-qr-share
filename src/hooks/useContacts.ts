import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { normalizePhoneWithCountryCode, normalizePhoneWithoutCountryCode } from "@/lib/phone-utils";

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
  contact_display_id?: string | null;
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
      toast.success("Contato criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar contato", {
        description: error.message.includes("unique_phone_per_user")
          ? "Este número já está cadastrado"
          : error.message,
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
      toast.success("Contato atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar contato", {
        description: error.message,
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
      toast.success("Contato excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir contato", {
        description: error.message,
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
      toast.success("Contatos excluídos!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir contatos", {
        description: error.message,
      });
    },
  });

  const importContacts = useMutation({
    mutationFn: async ({
      contacts,
      tagIds = [],
      newFields = [],
      deduplication,
      phoneNormalization,
    }: {
      contacts: { phone: string; name?: string; email?: string; notes?: string; contact_display_id?: string; custom_fields?: Record<string, unknown> }[];
      tagIds?: string[];
      newFields?: { field_name: string; field_key: string; field_type: string; options?: string[]; is_required?: boolean }[];
      deduplication?: { enabled: boolean; field: string; action: 'skip' | 'update' };
      phoneNormalization?: { mode: 'none' | 'add_ddi' | 'remove_ddi'; countryCode: string };
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      // First, create any new custom fields
      if (newFields.length > 0) {
        const fieldsToInsert = newFields.map((field, index) => ({
          field_name: field.field_name,
          field_key: field.field_key,
          field_type: field.field_type,
          options: field.options || [],
          is_required: field.is_required || false,
          display_order: index,
          user_id: userData.user!.id,
        }));

        const { error: fieldsError } = await supabase
          .from("custom_field_definitions")
          .insert(fieldsToInsert);

        if (fieldsError) {
          console.error("Error creating fields:", fieldsError);
          // Continue anyway, fields might already exist
        }
      }

      const normalizedContacts = contacts.map((c) => {
        let phone = c.phone.replace(/\D/g, "");
        
        // Apply phone normalization if configured
        if (phoneNormalization?.mode === 'add_ddi') {
          phone = normalizePhoneWithCountryCode(phone, phoneNormalization.countryCode);
        } else if (phoneNormalization?.mode === 'remove_ddi') {
          phone = normalizePhoneWithoutCountryCode(phone, phoneNormalization.countryCode);
        }
        
        return {
          phone,
          name: c.name || null,
          email: c.email || null,
          notes: c.notes || null,
          contact_display_id: c.contact_display_id || null,
          custom_fields: (c.custom_fields || {}) as Json,
          user_id: userData.user!.id,
        };
      });

      // Deduplicate within the import file (keep last occurrence)
      const uniqueContacts = Array.from(
        normalizedContacts.reduce((map, contact) => {
          map.set(contact.phone, contact);
          return map;
        }, new Map<string, typeof normalizedContacts[0]>()).values()
      );

      let contactsToInsert = uniqueContacts;
      let contactsToUpdate: typeof uniqueContacts = [];
      let skippedCount = 0;

      // If deduplication is enabled, check for existing contacts
      if (deduplication?.enabled) {
        // Fetch all existing contacts for this user
        const { data: existingContacts, error: fetchError } = await supabase
          .from("contacts")
          .select("id, phone, email, contact_display_id, custom_fields")
          .eq("user_id", userData.user.id);

        if (fetchError) {
          console.error("Error fetching existing contacts:", fetchError);
          throw fetchError;
        }

        // Create a map of existing contacts by the deduplication field
        const existingMap = new Map<string, { id: string }>();
        
        existingContacts?.forEach((contact) => {
          let key: string | null = null;
          
          switch (deduplication.field) {
            case 'phone':
              key = contact.phone;
              break;
            case 'email':
              key = contact.email?.toLowerCase() || null;
              break;
            case 'contact_display_id':
              key = contact.contact_display_id || null;
              break;
            default:
              if (deduplication.field.startsWith('custom:')) {
                const customKey = deduplication.field.replace('custom:', '');
                const customFields = contact.custom_fields as Record<string, unknown> | null;
                key = customFields?.[customKey]?.toString() || null;
              }
          }
          
          if (key) {
            existingMap.set(key, { id: contact.id });
          }
        });

        // Process contacts based on deduplication action
        if (deduplication.action === 'skip') {
          contactsToInsert = uniqueContacts.filter((contact) => {
            let key: string | null = null;
            
            switch (deduplication.field) {
              case 'phone':
                key = contact.phone;
                break;
              case 'email':
                key = contact.email?.toLowerCase() || null;
                break;
              case 'contact_display_id':
                key = contact.contact_display_id || null;
                break;
              default:
                if (deduplication.field.startsWith('custom:')) {
                  const customKey = deduplication.field.replace('custom:', '');
                  const customFields = contact.custom_fields as Record<string, unknown> | null;
                  key = customFields?.[customKey]?.toString() || null;
                }
            }
            
            if (key && existingMap.has(key)) {
              skippedCount++;
              return false;
            }
            return true;
          });
        } else {
          // action === 'update'
          contactsToInsert = [];
          
          uniqueContacts.forEach((contact) => {
            let key: string | null = null;
            
            switch (deduplication.field) {
              case 'phone':
                key = contact.phone;
                break;
              case 'email':
                key = contact.email?.toLowerCase() || null;
                break;
              case 'contact_display_id':
                key = contact.contact_display_id || null;
                break;
              default:
                if (deduplication.field.startsWith('custom:')) {
                  const customKey = deduplication.field.replace('custom:', '');
                  const customFields = contact.custom_fields as Record<string, unknown> | null;
                  key = customFields?.[customKey]?.toString() || null;
                }
            }
            
            if (key && existingMap.has(key)) {
              contactsToUpdate.push({ ...contact, id: existingMap.get(key)!.id } as typeof contact & { id: string });
            } else {
              contactsToInsert.push(contact);
            }
          });
        }
      }

      let insertedData: { id: string }[] = [];
      let updatedData: { id: string }[] = [];

      // Insert new contacts
      if (contactsToInsert.length > 0) {
        const { data, error } = await supabase
          .from("contacts")
          .upsert(contactsToInsert, {
            onConflict: "user_id,phone",
            ignoreDuplicates: false,
          })
          .select("id");

        if (error) throw error;
        insertedData = data || [];
      }

      // Update existing contacts
      if (contactsToUpdate.length > 0) {
        for (const contact of contactsToUpdate) {
          const { id, ...updateData } = contact as typeof contact & { id: string };
          const { data, error } = await supabase
            .from("contacts")
            .update(updateData)
            .eq("id", id)
            .select("id");

          if (error) {
            console.error("Error updating contact:", error);
            continue;
          }
          if (data) {
            updatedData.push(...data);
          }
        }
      }

      const allContactIds = [...insertedData.map(c => c.id), ...updatedData.map(c => c.id)];

      // Apply tags to imported/updated contacts if any were selected
      if (tagIds.length > 0 && allContactIds.length > 0) {
        const tagInserts = allContactIds.flatMap((contactId) =>
          tagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId }))
        );

        await supabase
          .from("contact_tags")
          .upsert(tagInserts, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      }

      return {
        total: contacts.length,
        new: insertedData.length,
        updated: updatedData.length,
        skipped: skippedCount,
      };
    },
    onSuccess: (stats) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      
      const messages: string[] = [];
      if (stats.new > 0) messages.push(`${stats.new} novo(s)`);
      if (stats.updated > 0) messages.push(`${stats.updated} atualizado(s)`);
      if (stats.skipped > 0) messages.push(`${stats.skipped} ignorado(s)`);
      
      toast.success(`Importação concluída: ${messages.join(', ')}`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao importar contatos", {
        description: error.message,
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
      toast.success(data.opted_out
        ? "Contato adicionado à blacklist"
        : "Contato removido da blacklist");
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
      toast.success("Tag criada!");
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
      toast.success("Tag excluída!");
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

  const bulkAddTags = useMutation({
    mutationFn: async ({
      contactIds,
      tagIds,
    }: {
      contactIds: string[];
      tagIds: string[];
    }) => {
      // Create all combinations of contact-tag pairs
      const inserts = contactIds.flatMap((contactId) =>
        tagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId }))
      );

      // Use upsert to avoid duplicates
      const { error } = await supabase
        .from("contact_tags")
        .upsert(inserts, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });

      if (error) throw error;
    },
    onSuccess: (_, { contactIds, tagIds }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${tagIds.length} tag(s) adicionada(s) a ${contactIds.length} contato(s)!`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar tags", {
        description: error.message,
      });
    },
  });

  const bulkRemoveTags = useMutation({
    mutationFn: async ({
      contactIds,
      tagIds,
    }: {
      contactIds: string[];
      tagIds: string[];
    }) => {
      // Delete all combinations of contact-tag pairs
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .in("contact_id", contactIds)
        .in("tag_id", tagIds);

      if (error) throw error;
    },
    onSuccess: (_, { contactIds, tagIds }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${tagIds.length} tag(s) removida(s) de ${contactIds.length} contato(s)!`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover tags", {
        description: error.message,
      });
    },
  });

  const bulkOptOut = useMutation({
    mutationFn: async ({
      contactIds,
      opted_out,
    }: {
      contactIds: string[];
      opted_out: boolean;
    }) => {
      const { error } = await supabase
        .from("contacts")
        .update({
          opted_out,
          opted_out_at: opted_out ? new Date().toISOString() : null,
        })
        .in("id", contactIds);

      if (error) throw error;
    },
    onSuccess: (_, { contactIds, opted_out }) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(opted_out
        ? `${contactIds.length} contato(s) marcado(s) como saído(s)`
        : `${contactIds.length} contato(s) reativado(s)`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar contatos", {
        description: error.message,
      });
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
    bulkAddTags,
    bulkRemoveTags,
    bulkOptOut,
  };
};
