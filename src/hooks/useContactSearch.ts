import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sanitizeSearchTerm = (term: string) => term.trim().replace(/[,%]/g, " ");

export const useContactSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: ["contact-search", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 3) return [];

      const safeTerm = sanitizeSearchTerm(searchTerm);
      const digitsOnly = safeTerm.replace(/\D/g, "");

      const orFilters = [
        `name.ilike.%${safeTerm}%`,
        `phone.ilike.%${safeTerm}%`,
        `contact_display_id.ilike.%${safeTerm}%`,
      ];

      if (digitsOnly && digitsOnly !== safeTerm) {
        orFilters.push(`phone.ilike.%${digitsOnly}%`);
      }

      const { data: matchingContacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id")
        .or(orFilters.join(","))
        .limit(500);

      if (contactsError) throw contactsError;

      const contactIds = matchingContacts?.map((contact) => contact.id) ?? [];
      if (contactIds.length === 0) return [];

      const { data: matchingConversations, error: conversationsError } = await supabase
        .from("conversations")
        .select("id")
        .in("contact_id", contactIds)
        .limit(1000);

      if (conversationsError) throw conversationsError;

      return matchingConversations?.map((conversation) => conversation.id) ?? [];
    },
    enabled: searchTerm.length >= 3,
    staleTime: 30000,
  });
};
