import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { UnifiedTask } from "./useUnifiedTasks";

export const useAllTasks = () => {
  const { user } = useAuth();
  const { organization, checkPermission } = useOrganization();
  
  // Admin = org owner or admin role member
  const isOrgAdmin = organization ? checkPermission('manage_settings') : true;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks', user?.id, isOrgAdmin],
    queryFn: async () => {
      if (!user) return [];

      const allTasks: UnifiedTask[] = [];

      // Fetch conversation tasks
      let convQuery = supabase.from('conversation_tasks').select('*');
      if (!isOrgAdmin) {
        // Non-admin: only own tasks or assigned to them
        convQuery = convQuery.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }
      const { data: convTasks, error: convErr } = await convQuery.order('created_at', { ascending: false });
      if (convErr) throw convErr;

      allTasks.push(...(convTasks || []).map(t => ({
        ...t,
        source: 'conversation' as const,
        due_time: t.due_time || null,
        task_type_id: t.task_type_id || null,
        assigned_to: t.assigned_to || null,
      })));

      // Fetch deal tasks
      let dealQuery = supabase.from('deal_tasks').select('*, funnel_deals(title)');
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

  return { tasks, pendingTasks, completedTasks, isLoading, isOrgAdmin };
};
