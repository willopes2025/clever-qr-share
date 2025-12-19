import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScrapedLead {
  id: string;
  user_id: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  cnae_code: string | null;
  cnae_description: string | null;
  porte: string | null;
  situacao_cadastral: string | null;
  capital_social: number | null;
  data_abertura: string | null;
  source: string;
  raw_data: Record<string, unknown> | null;
  imported_at: string | null;
  created_at: string;
}

interface ScrapeParams {
  estado_id: string;
  cidade_id?: string;
  cnae_id: string;
  limite: number;
  apenas_ativos?: boolean;
}

export function useScrapedLeads() {
  const queryClient = useQueryClient();

  // Fetch all scraped leads for the user
  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["scraped-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraped_leads")
        .select("*")
        .is("imported_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ScrapedLead[];
    },
  });

  // Scrape new leads from CNPJ.ws
  const scrapeLeads = useMutation({
    mutationFn: async (params: ScrapeParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("scrape-leads", {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to scrape leads");
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scraped-leads"] });
      toast.success(`${data.count} leads encontrados!`);
    },
    onError: (error: Error) => {
      console.error("Scrape error:", error);
      toast.error(`Erro ao buscar leads: ${error.message}`);
    },
  });

  // Import selected leads as contacts
  const importLeads = useMutation({
    mutationFn: async ({ leadIds, tagId }: { leadIds: string[]; tagId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get selected leads
      const { data: selectedLeads, error: leadsError } = await supabase
        .from("scraped_leads")
        .select("*")
        .in("id", leadIds);

      if (leadsError) throw leadsError;
      if (!selectedLeads?.length) throw new Error("No leads found");

      // Create contacts from leads
      const contacts = selectedLeads.map(lead => ({
        user_id: user.id,
        phone: lead.phone || lead.cnpj, // Use CNPJ as fallback if no phone
        name: lead.nome_fantasia || lead.razao_social,
        email: lead.email,
        notes: `CNPJ: ${lead.cnpj}\nEndereço: ${lead.address}, ${lead.neighborhood}, ${lead.city}-${lead.state}\nCNAE: ${lead.cnae_description}`,
        custom_fields: {
          cnpj: lead.cnpj,
          razao_social: lead.razao_social,
          porte: lead.porte,
          cnae_code: lead.cnae_code,
          source: 'scraped_lead',
        },
      }));

      // Insert contacts
      const { data: insertedContacts, error: insertError } = await supabase
        .from("contacts")
        .upsert(contacts, { onConflict: "user_id,phone", ignoreDuplicates: false })
        .select();

      if (insertError) throw insertError;

      // If tag is provided, add it to the contacts
      if (tagId && insertedContacts?.length) {
        const contactTags = insertedContacts.map(contact => ({
          contact_id: contact.id,
          tag_id: tagId,
        }));

        await supabase
          .from("contact_tags")
          .upsert(contactTags, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      }

      // Mark leads as imported
      await supabase
        .from("scraped_leads")
        .update({ imported_at: new Date().toISOString() })
        .in("id", leadIds);

      return insertedContacts;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scraped-leads"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${data?.length || 0} contatos importados com sucesso!`);
    },
    onError: (error: Error) => {
      console.error("Import error:", error);
      toast.error(`Erro ao importar leads: ${error.message}`);
    },
  });

  // Delete scraped leads
  const deleteLeads = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from("scraped_leads")
        .delete()
        .in("id", leadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scraped-leads"] });
      toast.success("Leads removidos com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover leads: ${error.message}`);
    },
  });

  return {
    leads,
    isLoading,
    refetch,
    scrapeLeads,
    importLeads,
    deleteLeads,
  };
}
