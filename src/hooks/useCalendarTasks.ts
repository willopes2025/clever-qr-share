import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";

export interface CalendarTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string | null;
  completed_at: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  google_event_id: string | null;
  sync_with_google: boolean;
  contact_id: string | null;
  conversation_id: string | null;
  user_id: string;
  created_at: string;
  source: 'conversation' | 'deal';
  contact_name?: string | null;
  deal_title?: string | null;
  task_type?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  assignee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export type ViewMode = 'day' | 'week' | 'month';

export function useCalendarTasks(currentDate: Date, viewMode: ViewMode) {
  const { user } = useAuth();

  const getDateRange = () => {
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate, { weekStartsOn: 0 }), end: endOfWeek(currentDate, { weekStartsOn: 0 }) };
      case 'month':
      default:
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return { 
          start: startOfWeek(monthStart, { weekStartsOn: 0 }), 
          end: endOfWeek(monthEnd, { weekStartsOn: 0 }) 
        };
    }
  };

  const { start, end } = getDateRange();

  return useQuery({
    queryKey: ['calendar-tasks', user?.id, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!user?.id) return [];

      // Buscar conversation_tasks
      const { data: conversationTasks, error: convError } = await supabase
        .from('conversation_tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          due_time,
          priority,
          completed_at,
          task_type_id,
          assigned_to,
          google_event_id,
          sync_with_google,
          contact_id,
          conversation_id,
          user_id,
          created_at
        `)
        .gte('due_date', format(start, 'yyyy-MM-dd'))
        .lte('due_date', format(end, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true });

      if (convError) throw convError;

      // Buscar deal_tasks
      const { data: dealTasks, error: dealError } = await supabase
        .from('deal_tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          due_time,
          priority,
          completed_at,
          task_type_id,
          assigned_to,
          google_event_id,
          sync_with_google,
          user_id,
          created_at,
          deal_id
        `)
        .gte('due_date', format(start, 'yyyy-MM-dd'))
        .lte('due_date', format(end, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true });

      if (dealError) throw dealError;

      // Buscar tipos de tarefa e assignees
      const taskTypeIds = [...new Set([
        ...(conversationTasks || []).map(t => t.task_type_id).filter(Boolean),
        ...(dealTasks || []).map(t => t.task_type_id).filter(Boolean),
      ])];

      const assigneeIds = [...new Set([
        ...(conversationTasks || []).map(t => t.assigned_to).filter(Boolean),
        ...(dealTasks || []).map(t => t.assigned_to).filter(Boolean),
      ])];

      let taskTypesMap: Record<string, any> = {};
      let assigneesMap: Record<string, any> = {};

      if (taskTypeIds.length > 0) {
        const { data: types } = await supabase
          .from('task_types')
          .select('id, name, icon, color')
          .in('id', taskTypeIds);
        
        types?.forEach(t => { taskTypesMap[t.id] = t; });
      }

      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', assigneeIds);
        
        profiles?.forEach(p => { assigneesMap[p.id] = p; });
      }

      // Buscar nomes de contatos
      const contactIds = [...new Set((conversationTasks || []).map(t => t.contact_id).filter(Boolean))];
      let contactsMap: Record<string, string> = {};

      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', contactIds);
        
        contacts?.forEach(c => { contactsMap[c.id] = c.name || 'Sem nome'; });
      }

      // Buscar títulos de deals
      const dealIds = [...new Set((dealTasks || []).map(t => (t as any).deal_id).filter(Boolean))];
      let dealsMap: Record<string, string> = {};

      if (dealIds.length > 0) {
        const { data: deals } = await supabase
          .from('funnel_deals')
          .select('id, title')
          .in('id', dealIds);
        
        deals?.forEach(d => { dealsMap[d.id] = d.title || 'Sem título'; });
      }

      // Combinar e mapear tarefas
      const allTasks: CalendarTask[] = [
        ...(conversationTasks || []).map(t => ({
          ...t,
          sync_with_google: t.sync_with_google || false,
          source: 'conversation' as const,
          contact_name: t.contact_id ? contactsMap[t.contact_id] : null,
          deal_title: null,
          task_type: t.task_type_id ? taskTypesMap[t.task_type_id] : null,
          assignee: t.assigned_to ? assigneesMap[t.assigned_to] : null,
        })),
        ...(dealTasks || []).map(t => ({
          ...t,
          sync_with_google: t.sync_with_google || false,
          contact_id: null,
          conversation_id: null,
          source: 'deal' as const,
          contact_name: null,
          deal_title: (t as any).deal_id ? dealsMap[(t as any).deal_id] : null,
          task_type: t.task_type_id ? taskTypesMap[t.task_type_id] : null,
          assignee: t.assigned_to ? assigneesMap[t.assigned_to] : null,
        })),
      ];

      return allTasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const dateCompare = a.due_date.localeCompare(b.due_date);
        if (dateCompare !== 0) return dateCompare;
        if (!a.due_time) return 1;
        if (!b.due_time) return -1;
        return a.due_time.localeCompare(b.due_time);
      });
    },
    enabled: !!user?.id,
  });
}
