import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { getDateRange, DateRange, CustomDateRange } from './useDashboardMetricsV2';

export interface MessagesByHourUser {
  userId: string;
  name: string;
}

export interface MessagesByHourResult {
  /** 24-item array: [{ hour: 0, total: n }, ...] */
  aggregate: Array<{ hour: number; hourLabel: string; total: number }>;
  /** 24-item array: [{ hour: 0, hourLabel: '00h', [userName]: count, ... }] */
  byUser: Array<Record<string, number | string>>;
  /** users found in the dataset */
  users: MessagesByHourUser[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h: number) => `${h.toString().padStart(2, '0')}h`;

export const useMessagesByHour = (
  dateRange: DateRange = '7d',
  customRange?: CustomDateRange,
) => {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: [
      'messages-by-hour',
      organization?.id,
      dateRange,
      customRange?.from?.toISOString(),
      customRange?.to?.toISOString(),
    ],
    enabled: !!organization?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MessagesByHourResult> => {
      const { start, end } = getDateRange(dateRange, customRange);
      const orgId = organization!.id;

      // Members of the organization
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, owner_id')
        .eq('id', orgId)
        .maybeSingle();

      const { data: tmRows } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      const userIds = new Set<string>();
      if (orgRow?.owner_id) userIds.add(orgRow.owner_id);
      (tmRows || []).forEach((t) => t.user_id && userIds.add(t.user_id));
      const userIdList = Array.from(userIds);

      const empty: MessagesByHourResult = {
        aggregate: HOURS.map((h) => ({ hour: h, hourLabel: fmtHour(h), total: 0 })),
        byUser: HOURS.map((h) => ({ hour: h, hourLabel: fmtHour(h) })),
        users: [],
      };

      if (userIdList.length === 0) return empty;

      // Profiles for name resolution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIdList);

      const nameByUser = new Map<string, string>();
      (profiles || []).forEach((p) =>
        nameByUser.set(p.id, p.full_name || 'Sem nome'),
      );

      // Call RPC
      const { data, error } = await supabase.rpc('get_messages_by_hour' as any, {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_user_ids: userIdList,
      });

      if (error) {
        console.error('get_messages_by_hour error', error);
        return empty;
      }

      const rows = (data || []) as Array<{
        user_id: string;
        hour: number;
        message_count: number;
      }>;

      // Aggregate per hour
      const aggregateMap = new Map<number, number>();
      const usersInData = new Map<string, string>();
      // hour -> { userName: count }
      const byHourUser = new Map<number, Map<string, number>>();

      rows.forEach((r) => {
        const h = Number(r.hour);
        const count = Number(r.message_count);
        aggregateMap.set(h, (aggregateMap.get(h) || 0) + count);

        const name = nameByUser.get(r.user_id) || 'Sem nome';
        usersInData.set(r.user_id, name);

        if (!byHourUser.has(h)) byHourUser.set(h, new Map());
        const inner = byHourUser.get(h)!;
        inner.set(name, (inner.get(name) || 0) + count);
      });

      const aggregate = HOURS.map((h) => ({
        hour: h,
        hourLabel: fmtHour(h),
        total: aggregateMap.get(h) || 0,
      }));

      const byUser = HOURS.map((h) => {
        const row: Record<string, number | string> = {
          hour: h,
          hourLabel: fmtHour(h),
        };
        const inner = byHourUser.get(h);
        usersInData.forEach((name) => {
          row[name] = inner?.get(name) || 0;
        });
        return row;
      });

      const users: MessagesByHourUser[] = Array.from(usersInData.entries())
        .map(([userId, name]) => ({ userId, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { aggregate, byUser, users };
    },
  });
};
