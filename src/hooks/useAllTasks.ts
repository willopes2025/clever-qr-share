import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { UnifiedTask } from "./useUnifiedTasks";

export interface AllTaskItem extends UnifiedTask {
  contact_name: string | null;
  contact_phone: string | null;
  contact_display_id: string | null;
  completion_notes: string | null;
}

export const useAllTasks = () => {
  const { user } = useAuth();
  const { organization, checkPermission } = useOrganization();
  
  const isOrgAdmin = organization ? checkPermission('manage_settings') : true;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks', user?.id, isOrgAdmin],
    queryFn: async () => {
      if (!user) return [];

      const allTasks: AllTaskItem[] = [];

      // Fetch conversation tasks with contact info
      let convQuery = supabase.from('conversation_tasks').select('*, contacts(contact_display_id, name, phone)');
      if (!isOrgAdmin) {
        convQuery = convQuery.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }
      const { data: convTasks, error: convErr } = await convQuery.order('created_at', { ascending: false });
      if (convErr) throw convErr;

      allTasks.push(...(convTasks || []).map((t: any) => ({
        ...t,
        source: 'conversation' as const,
        due_time: t.due_time || null,
        task_type_id: t.task_type_id || null,
        assigned_to: t.assigned_to || null,
        contact_name: t.contacts?.name || null,
        contact_phone: t.contacts?.phone || null,
        contact_display_id: t.contacts?.contact_display_id || null,
        completion_notes: t.completion_notes || null,
        contacts: undefined,
      })));

      // Fetch deal tasks with deal + contact info
      let dealQuery = supabase.from('deal_tasks').select('*, funnel_deals(title, contact_id, contacts(contact_display_id, name, phone))');
      if (!isOrgAdmin) {
        dealQuery = dealQuery.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }
      const { data: dealTasks, error: dealErr } = await dealQuery.order('created_at', { ascending: false });
      if (dealErr) throw dealErr;

      allTasks.push(...(dealTasks || []).map((t: any) => ({
        ...t,
        source: 'deal' as const,
        due_time: t.due_time || null,
        task_type_id: t.task_type_id || null,
        assigned_to: t.assigned_to || null,
        deal_title: t.funnel_deals?.title || null,
        contact_name: t.funnel_deals?.contacts?.name || null,
        contact_phone: t.funnel_deals?.contacts?.phone || null,
        contact_display_id: t.funnel_deals?.contacts?.contact_display_id || null,
        completion_notes: t.completion_notes || null,
        funnel_deals: undefined,
      })));

      // Sort: pending first, then by due_date
      return allTasks.sort((a, b) => {
        if (a.completed_at && !b.completed_at) return 1;
        if (!a.completed_at && b.completed_at) return -1;
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!user,
  });

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => !!t.completed_at);

  // Deduplicated assignee IDs (only assigned_to, not user_id)
  const assigneeIds = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))] as string[];

  return { tasks, pendingTasks, completedTasks, isLoading, isOrgAdmin, assigneeIds };
};
