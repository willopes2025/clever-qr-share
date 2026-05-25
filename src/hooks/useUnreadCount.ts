import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInboxHiddenInstances } from "@/hooks/useInboxHiddenInstances";

/**
 * Counts unread conversations exactly the same way the Inbox list does.
 *
 * Must mirror the filters in `useConversations` so that the badge in the
 * sidebar and the `(N)` prefix in the browser tab title match the number
 * the user sees in the Inbox "Não lidas" tab.
 *
 * Filters applied (after the SQL `unread_count > 0 AND status != 'archived'`):
 *  - respect per-member instance restriction (`get_member_instance_ids`)
 *  - exclude conversations whose instance is `is_notification_only`
 *  - exclude conversations whose instance the user hid from the Inbox
 *  - exclude "ghost" conversations (no preview, no direction, no contact name)
 *  - exclude conversations whose contact phone belongs to the warming pool
 */
export const useUnreadCount = () => {
  const { user } = useAuth();
  const { hiddenIds } = useInboxHiddenInstances();

  return useQuery({
    queryKey: ['unread-count', user?.id, hiddenIds.join(',')],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Per-member instance restriction (same as useConversations)
      const { data: hasRestrictionData } = await supabase.rpc(
        'member_has_instance_restriction',
        { _user_id: user.id },
      );
      const hasInstanceRestriction = !!hasRestrictionData;
      let allowedInstanceIds: string[] | null = null;
      if (hasInstanceRestriction) {
        const { data: allowed } = await supabase.rpc('get_member_instance_ids', {
          _user_id: user.id,
        });
        allowedInstanceIds = (allowed as string[] | null) ?? [];
      }

      // Parallel: notification-only instances + warming phones set
      const [notifRes, wcRes, wpRes] = await Promise.all([
        supabase.from('whatsapp_instances').select('id').eq('is_notification_only', true),
        supabase.from('warming_contacts').select('phone'),
        supabase.from('warming_pool').select('phone_number'),
      ]);

      const notifSet = new Set((notifRes.data ?? []).map((i: any) => i.id as string));
      const hiddenSet = new Set(hiddenIds);
      const warmingPhones = new Set<string>();
      ((wcRes.data as { phone: string | null }[] | null) ?? []).forEach((r) => {
        if (r.phone) warmingPhones.add(r.phone.replace(/\D/g, ''));
      });
      ((wpRes.data as { phone_number: string | null }[] | null) ?? []).forEach((r) => {
        if (r.phone_number) warmingPhones.add(r.phone_number.replace(/\D/g, ''));
      });

      // Fetch only fields needed for filtering / counting
      let query = supabase
        .from('conversations')
        .select('id, instance_id, contact_id, last_message_preview, last_message_direction')
        .gt('unread_count', 0)
        .neq('status', 'archived');

      if (hasInstanceRestriction && allowedInstanceIds !== null) {
        if (allowedInstanceIds.length > 0) {
          query = query.or(
            `instance_id.in.(${allowedInstanceIds.join(',')}),instance_id.is.null`,
          );
        } else {
          query = query.is('instance_id', null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      if (rows.length === 0) return 0;

      // Server-side instance filters (notification-only + per-user hidden)
      const filteredByInstance = rows.filter(
        (r) =>
          (!r.instance_id || !notifSet.has(r.instance_id)) &&
          (!r.instance_id || !hiddenSet.has(r.instance_id))
      );

      // Fetch contact names/phones in chunks for ghost + warming filters
      const contactIds = Array.from(
        new Set(filteredByInstance.map((r) => r.contact_id).filter(Boolean))
      );
      const contactsMap: Record<string, { name: string | null; phone: string | null }> = {};
      if (contactIds.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < contactIds.length; i += CHUNK) {
          const slice = contactIds.slice(i, i + CHUNK);
          const { data: cs } = await supabase
            .from('contacts')
            .select('id, name, phone')
            .in('id', slice);
          ((cs as any[]) ?? []).forEach((c) => {
            contactsMap[c.id] = { name: c.name, phone: c.phone };
          });
        }
      }

      const visible = filteredByInstance.filter((conv) => {
        const contact = contactsMap[conv.contact_id];
        const hasPreview = !!conv.last_message_preview;
        const hasDirection = !!conv.last_message_direction;
        const contactName = (contact?.name || '').trim();
        if (!(hasPreview || hasDirection || contactName.length > 0)) return false;
        const phoneDigits = (contact?.phone || '').replace(/\D/g, '');
        if (phoneDigits && warmingPhones.has(phoneDigits)) return false;
        return true;
      });

      return visible.length;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
};
