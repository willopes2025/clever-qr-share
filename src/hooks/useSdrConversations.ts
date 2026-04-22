import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface SdrConversation {
  id: string;
  user_id: string;
  contact_id: string;
  instance_id: string | null;
  meta_phone_number_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  is_pinned: boolean | null;
  created_at: string;
  updated_at: string;
  provider?: "evolution" | "meta" | null;
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    avatar_url?: string | null;
  };
  organization_id?: string | null;
  organization_name?: string | null;
}

export interface SdrAssignmentScope {
  organizations: { id: string; name: string }[];
  instances: { id: string; instance_name: string; phone_number?: string | null }[];
  metaNumbers: { id: string; display_phone_number: string | null; phone_number_id: string | null }[];
}

export const useSdrScope = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sdr-scope", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SdrAssignmentScope> => {
      // Organizations the SDR is assigned to
      const { data: assignments, error: aErr } = await supabase
        .from("sdr_assignments" as any)
        .select("id, organization_id, organizations(id, name)")
        .eq("sdr_user_id", user!.id);
      if (aErr) throw aErr;

      const orgs =
        (assignments as any[])?.map((a) => ({
          id: a.organizations?.id,
          name: a.organizations?.name,
        })).filter((o) => o.id) || [];

      // Instances
      const { data: instAccess, error: iErr } = await supabase
        .from("sdr_instance_access" as any)
        .select("instance_id, whatsapp_instances(id, instance_name, phone_number)");
      if (iErr) throw iErr;
      const instances =
        (instAccess as any[])?.map((r) => r.whatsapp_instances).filter(Boolean) || [];

      // Meta numbers
      const { data: metaAccess, error: mErr } = await supabase
        .from("sdr_meta_number_access" as any)
        .select("meta_number_id, meta_whatsapp_numbers(id, display_phone_number, phone_number_id)");
      if (mErr) throw mErr;
      const metaNumbers =
        (metaAccess as any[])?.map((r) => r.meta_whatsapp_numbers).filter(Boolean) || [];

      return { organizations: orgs, instances, metaNumbers };
    },
  });
};

export const useSdrConversations = (filters?: {
  organizationId?: string | null;
  instanceId?: string | null;
  metaPhoneNumberId?: string | null;
}) => {
  const { user } = useAuth();
  const { data: scope } = useSdrScope();

  return useQuery({
    queryKey: ["sdr-conversations", user?.id, filters, scope?.organizations.length],
    enabled: !!user && !!scope,
    queryFn: async () => {
      // Build org → name map and owner_id per org for badges
      const orgIds = scope!.organizations.map((o) => o.id);
      const instanceIds = scope!.instances.map((i) => i.id);
      const metaPhoneIds = scope!.metaNumbers
        .map((m) => m.phone_number_id)
        .filter(Boolean) as string[];

      let query = supabase
        .from("conversations")
        .select(
          `id, user_id, contact_id, instance_id, meta_phone_number_id, last_message_at,
           last_message_preview, unread_count, status, is_pinned, created_at, updated_at,
           provider,
           contact:contacts(id, name, phone, avatar_url),
           instance:whatsapp_instances(id, instance_name, user_id)`
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);

      // OR over instance_id and meta_phone_number_id
      const conds: string[] = [];
      if (instanceIds.length) conds.push(`instance_id.in.(${instanceIds.join(",")})`);
      if (metaPhoneIds.length)
        conds.push(`meta_phone_number_id.in.(${metaPhoneIds.map((s) => `"${s}"`).join(",")})`);
      if (conds.length === 0) return [] as SdrConversation[];
      query = query.or(conds.join(","));

      if (filters?.instanceId) query = query.eq("instance_id", filters.instanceId);
      if (filters?.metaPhoneNumberId)
        query = query.eq("meta_phone_number_id", filters.metaPhoneNumberId);

      const { data, error } = await query;
      if (error) throw error;

      // Attach organization name based on instance owner -> org membership (best effort)
      // We'll resolve via team_members → organization
      const userIds = Array.from(
        new Set(((data as any[]) || []).map((c) => c.instance?.user_id || c.user_id).filter(Boolean))
      );
      let userOrgMap = new Map<string, { id: string; name: string }>();
      if (userIds.length && orgIds.length) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("user_id, organization_id, organizations(id, name)")
          .in("user_id", userIds)
          .in("organization_id", orgIds);
        (tm as any[])?.forEach((row) => {
          if (row.user_id && row.organizations) {
            userOrgMap.set(row.user_id, { id: row.organizations.id, name: row.organizations.name });
          }
        });
        // Owner fallback
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name, owner_id")
          .in("id", orgIds);
        (orgs as any[])?.forEach((o) => {
          if (o.owner_id && !userOrgMap.has(o.owner_id)) {
            userOrgMap.set(o.owner_id, { id: o.id, name: o.name });
          }
        });
      }

      let result = ((data as any[]) || []).map((c) => {
        const ownerId = c.instance?.user_id || c.user_id;
        const org = userOrgMap.get(ownerId);
        return {
          ...c,
          organization_id: org?.id || null,
          organization_name: org?.name || null,
        } as SdrConversation;
      });

      if (filters?.organizationId) {
        result = result.filter((c) => c.organization_id === filters.organizationId);
      }

      return result;
    },
  });
};
