import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from './useOrganization';
import { getDateRange, DateRange, CustomDateRange } from './useDashboardMetricsV2';

export interface MemberProductivity {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  workSeconds: number;
  breakSeconds: number;
  lunchSeconds: number;
  messagesSent: number;
  messagesReceived: number;
  charactersTyped: number;
  audiosSent: number;
  mediaSent: number;
  conversationsHandled: number;
  conversationsResolved: number;
  dealsCreated: number;
  dealsWon: number;
  dealsValue: number;
  tasksCompleted: number;
  notesCreated: number;
  avgResponseSeconds: number | null;
  lastActivityAt: string | null;
  currentStatus: 'work' | 'break' | 'lunch' | 'meeting' | 'offline';
}

export interface MemberProductivityResult {
  members: MemberProductivity[];
  totals: {
    workSeconds: number;
    messagesSent: number;
    messagesReceived: number;
    charactersTyped: number;
    conversationsHandled: number;
    dealsWon: number;
    dealsValue: number;
    avgResponseSeconds: number;
  };
}



export const useMemberProductivity = (
  dateRange: DateRange = '7d',
  customRange?: CustomDateRange,
) => {
  const { organization } = useOrganization();

  return useQuery({
    queryKey: [
      'member-productivity',
      organization?.id,
      dateRange,
      customRange?.from?.toISOString(),
      customRange?.to?.toISOString(),
    ],
    enabled: !!organization?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MemberProductivityResult> => {
      const { start, end } = getDateRange(dateRange, customRange);
      const orgId = organization!.id;

      // 1. Members of the organization (including owner)
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, owner_id')
        .eq('id', orgId)
        .maybeSingle();

      const { data: tmRows } = await supabase
        .from('team_members')
        .select('user_id, email, role, status')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      const userIds = new Set<string>();
      if (orgRow?.owner_id) userIds.add(orgRow.owner_id);
      (tmRows || []).forEach((t) => t.user_id && userIds.add(t.user_id));
      const userIdList = Array.from(userIds);

      if (userIdList.length === 0) {
        return {
          members: [],
          totals: {
            workSeconds: 0,
            messagesSent: 0,
            messagesReceived: 0,
            charactersTyped: 0,
            conversationsHandled: 0,
            dealsWon: 0,
            dealsValue: 0,
            avgResponseSeconds: 0,
          },
        };
      }

      // 2. Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIdList);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p]),
      );
      const teamMemberMap = new Map(
        (tmRows || []).map((t) => [t.user_id as string, t]),
      );

      // 3. Performance metrics in date range
      const { data: metrics } = await supabase
        .from('user_performance_metrics')
        .select('*')
        .eq('organization_id', orgId)
        .gte('metric_date', start.toISOString().slice(0, 10))
        .lte('metric_date', end.toISOString().slice(0, 10));

      // 4. Activity sessions in date range (filter by user_id IN org members,
      // because organization_id is often NULL on legacy/early sessions)
      const { data: sessions } = await supabase
        .from('user_activity_sessions')
        .select('user_id, session_type, started_at, ended_at, duration_seconds')
        .in('user_id', userIdList)
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString());

      // 5. Open sessions for current status — also include last_activity to detect stale sessions
      const { data: openSessions } = await supabase
        .from('user_activity_sessions')
        .select('user_id, session_type, started_at, last_activity')
        .in('user_id', userIdList)
        .is('ended_at', null)
        .order('started_at', { ascending: false });

      // 6. Outbound messages -> chars + audio + media + sent count
      const { data: outMessages } = await supabase
        .from('inbox_messages')
        .select('sent_by_user_id, content, message_type')
        .eq('direction', 'outbound')
        .in('sent_by_user_id', userIdList)
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString())
        .limit(20000);

      // 6b. Inbound messages -> count received per assigned member
      const { data: inMessages } = await supabase
        .from('inbox_messages')
        .select('conversation_id')
        .eq('direction', 'inbound')
        .gte('sent_at', start.toISOString())
        .lte('sent_at', end.toISOString())
        .limit(20000);

      const inboundConvIds = Array.from(
        new Set((inMessages || []).map((m: any) => m.conversation_id).filter(Boolean)),
      );
      const { data: inboundConvs } = inboundConvIds.length
        ? await supabase
            .from('conversations')
            .select('id, assigned_to, user_id')
            .in('id', inboundConvIds)
        : { data: [] as any[] };
      const convOwnerMap = new Map<string, string>();
      (inboundConvs || []).forEach((c: any) => {
        const owner = c.assigned_to || c.user_id;
        if (owner) convOwnerMap.set(c.id, owner);
      });

      // 7. Notes created in range
      const { data: notes } = await supabase
        .from('conversation_notes')
        .select('user_id')
        .in('user_id', userIdList)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // ===== Aggregate =====
      const memberMap = new Map<string, MemberProductivity>();

      for (const uid of userIdList) {
        const profile = profileMap.get(uid);
        const tm = teamMemberMap.get(uid);
        memberMap.set(uid, {
          userId: uid,
          name: profile?.full_name || tm?.email || 'Sem nome',
          email: tm?.email || '',
          avatarUrl: profile?.avatar_url || null,
          role: orgRow?.owner_id === uid ? 'owner' : tm?.role || 'member',
          workSeconds: 0,
          breakSeconds: 0,
          lunchSeconds: 0,
          messagesSent: 0,
          messagesReceived: 0,
          charactersTyped: 0,
          audiosSent: 0,
          mediaSent: 0,
          conversationsHandled: 0,
          conversationsResolved: 0,
          dealsCreated: 0,
          dealsWon: 0,
          dealsValue: 0,
          tasksCompleted: 0,
          notesCreated: 0,
          avgResponseSeconds: null,
          lastActivityAt: null,
          currentStatus: 'offline',
        });
      }

      // Performance metrics aggregation
      let respSum = 0;
      let respCount = 0;
      (metrics || []).forEach((m) => {
        const member = memberMap.get(m.user_id);
        if (!member) return;
        // messagesSent / messagesReceived são calculados a partir de inbox_messages
        // (fonte de verdade) mais abaixo, em vez do cache user_performance_metrics.
        member.conversationsHandled += m.conversations_handled || 0;
        member.conversationsResolved += m.conversations_resolved || 0;
        member.dealsCreated += m.deals_created || 0;
        member.dealsWon += m.deals_won || 0;
        member.dealsValue += Number(m.deals_value || 0);
        member.tasksCompleted += m.tasks_completed || 0;
        member.workSeconds += m.total_work_seconds || 0;
        member.breakSeconds += m.total_break_seconds || 0;
        member.lunchSeconds += m.total_lunch_seconds || 0;
        if (m.avg_response_time_seconds) {
          respSum += m.avg_response_time_seconds;
          respCount += 1;
          member.avgResponseSeconds =
            (member.avgResponseSeconds || 0) + m.avg_response_time_seconds;
        }
        if (m.last_activity_at) {
          if (!member.lastActivityAt || m.last_activity_at > member.lastActivityAt) {
            member.lastActivityAt = m.last_activity_at;
          }
        }
      });

      // Sessions aggregation (overrides perf metrics if more accurate)
      const sessionWork = new Map<string, { work: number; break: number; lunch: number }>();
      (sessions || []).forEach((s) => {
        if (!s.user_id) return;
        const dur =
          s.duration_seconds ??
          (s.ended_at
            ? Math.max(
                0,
                (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000,
              )
            : 0);
        const cur = sessionWork.get(s.user_id) || { work: 0, break: 0, lunch: 0 };
        if (s.session_type === 'work') cur.work += dur;
        else if (s.session_type === 'break') cur.break += dur;
        else if (s.session_type === 'lunch') cur.lunch += dur;
        sessionWork.set(s.user_id, cur);
      });
      sessionWork.forEach((v, uid) => {
        const m = memberMap.get(uid);
        if (!m) return;
        // prefer the larger value (sessions are source of truth when available)
        m.workSeconds = Math.max(m.workSeconds, Math.round(v.work));
        m.breakSeconds = Math.max(m.breakSeconds, Math.round(v.break));
        m.lunchSeconds = Math.max(m.lunchSeconds, Math.round(v.lunch));
      });

      // Current status from open sessions.
      // Rule: pick the MOST RECENT open session per user (latest started_at).
      // If last_activity (or started_at) is older than IDLE_THRESHOLD, mark offline.
      const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
      const now = Date.now();
      const latestOpen = new Map<string, { type: string; ts: number; activity: number }>();
      (openSessions || []).forEach((s) => {
        if (!s.user_id) return;
        const startedTs = new Date(s.started_at).getTime();
        const activityTs = s.last_activity ? new Date(s.last_activity).getTime() : startedTs;
        const existing = latestOpen.get(s.user_id);
        if (!existing || startedTs > existing.ts) {
          latestOpen.set(s.user_id, { type: s.session_type, ts: startedTs, activity: activityTs });
        }
      });
      latestOpen.forEach((entry, uid) => {
        const m = memberMap.get(uid);
        if (!m) return;
        const isStale = now - entry.activity > IDLE_THRESHOLD_MS;
        if (isStale) {
          m.currentStatus = 'offline';
        } else if (
          entry.type === 'work' ||
          entry.type === 'break' ||
          entry.type === 'lunch' ||
          entry.type === 'meeting'
        ) {
          m.currentStatus = entry.type as MemberProductivity['currentStatus'];
        }
        // Update lastActivityAt with the freshest signal
        const activityIso = new Date(entry.activity).toISOString();
        if (!m.lastActivityAt || activityIso > m.lastActivityAt) {
          m.lastActivityAt = activityIso;
        }
      });

      // Outbound messages aggregation: chars + media split
      (outMessages || []).forEach((msg) => {
        const m = memberMap.get(msg.sent_by_user_id as string);
        if (!m) return;
        m.charactersTyped += (msg.content || '').length;
        if (msg.message_type === 'audio') m.audiosSent += 1;
        else if (msg.message_type && msg.message_type !== 'text') m.mediaSent += 1;
      });

      // Notes
      (notes || []).forEach((n) => {
        const m = memberMap.get(n.user_id as string);
        if (m) m.notesCreated += 1;
      });

      const members = Array.from(memberMap.values()).sort(
        (a, b) => b.messagesSent + b.dealsWon * 5 - (a.messagesSent + a.dealsWon * 5),
      );

      const totals = members.reduce(
        (acc, m) => {
          acc.workSeconds += m.workSeconds;
          acc.messagesSent += m.messagesSent;
          acc.messagesReceived += m.messagesReceived;
          acc.charactersTyped += m.charactersTyped;
          acc.conversationsHandled += m.conversationsHandled;
          acc.dealsWon += m.dealsWon;
          acc.dealsValue += m.dealsValue;
          return acc;
        },
        {
          workSeconds: 0,
          messagesSent: 0,
          messagesReceived: 0,
          charactersTyped: 0,
          conversationsHandled: 0,
          dealsWon: 0,
          dealsValue: 0,
          avgResponseSeconds: respCount > 0 ? Math.round(respSum / respCount) : 0,
        },
      );

      return { members, totals };
    },
  });
};
