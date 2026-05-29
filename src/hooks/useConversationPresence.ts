import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface SelfInfo extends PresenceUser {}

let selfCache: SelfInfo | null = null;

async function loadSelf(): Promise<SelfInfo | null> {
  if (selfCache) return selfCache;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  selfCache = {
    user_id: user.id,
    full_name:
      (profile?.full_name as string | null) ||
      (user.email?.split("@")[0] ?? "Usuário"),
    avatar_url: (profile?.avatar_url as string | null) ?? null,
  };
  return selfCache;
}

export function useConversationPresence(conversationId: string | null | undefined) {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const [typingMap, setTypingMap] = useState<Record<string, PresenceUser>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef<SelfInfo | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const lastTypingSentRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const self = await loadSelf();
      if (!self || cancelled) return;
      selfRef.current = self;

      const channelName = `conversation-presence:${conversationId}`;

      channel = supabase.channel(channelName, {
        config: { presence: { key: self.user_id } },
      });

      const recomputeOthers = () => {
        if (!channel) return;
        const state = channel.presenceState<PresenceUser>();
        const list: PresenceUser[] = [];
        const seen = new Set<string>();
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (!entry?.user_id) return;
            if (entry.user_id === self.user_id) return;
            if (seen.has(entry.user_id)) return;
            seen.add(entry.user_id);
            list.push({
              user_id: entry.user_id,
              full_name: entry.full_name,
              avatar_url: entry.avatar_url ?? null,
            });
          });
        });
        setOthers(list);
        setTypingMap((prev) => {
          const next: typeof prev = {};
          for (const u of list) if (prev[u.user_id]) next[u.user_id] = prev[u.user_id];
          return next;
        });
      };

      channel
        .on("presence", { event: "sync" }, () => {
          recomputeOthers();
        })
        .on("presence", { event: "join" }, () => {
          recomputeOthers();
        })
        .on("presence", { event: "leave" }, () => {
          recomputeOthers();
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const p = payload as { user_id: string; is_typing: boolean; full_name?: string; avatar_url?: string | null };
          if (!p?.user_id || p.user_id === self.user_id) return;

          if (p.is_typing) {
            setTypingMap((prev) => ({
              ...prev,
              [p.user_id]: {
                user_id: p.user_id,
                full_name: p.full_name ?? prev[p.user_id]?.full_name ?? "Alguém",
                avatar_url: p.avatar_url ?? prev[p.user_id]?.avatar_url ?? null,
              },
            }));
            if (typingTimersRef.current[p.user_id]) {
              clearTimeout(typingTimersRef.current[p.user_id]);
            }
            typingTimersRef.current[p.user_id] = setTimeout(() => {
              setTypingMap((prev) => {
                const { [p.user_id]: _, ...rest } = prev;
                return rest;
              });
              delete typingTimersRef.current[p.user_id];
            }, 4000);
          } else {
            if (typingTimersRef.current[p.user_id]) {
              clearTimeout(typingTimersRef.current[p.user_id]);
              delete typingTimersRef.current[p.user_id];
            }
            setTypingMap((prev) => {
              const { [p.user_id]: _, ...rest } = prev;
              return rest;
            });
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            isSubscribedRef.current = true;
            try {
              await channel.track({
                user_id: self.user_id,
                full_name: self.full_name,
                avatar_url: self.avatar_url,
                joined_at: new Date().toISOString(),
              });
            } catch (e) {
              console.error("[presence] track failed", e);
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isSubscribedRef.current = false;
          }
        });

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      isSubscribedRef.current = false;
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) {
        try {
          ch.untrack();
        } catch {}
        supabase.removeChannel(ch);
      }
      setOthers([]);
      setTypingMap({});
    };
  }, [conversationId]);

  const notifyTyping = useCallback(() => {
    const ch = channelRef.current;
    const self = selfRef.current;
    if (!ch || !self) {
      console.log("[presence] notifyTyping skipped: no channel/self");
      return;
    }
    if (!isSubscribedRef.current) {
      console.log("[presence] notifyTyping skipped: not subscribed yet");
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      console.log("[presence] broadcast typing sent (true)");
      ch.send({
        type: "broadcast",
        event: "typing",
        payload: {
          user_id: self.user_id,
          full_name: self.full_name,
          avatar_url: self.avatar_url,
          is_typing: true,
        },
      });
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      lastTypingSentRef.current = 0;
      console.log("[presence] broadcast typing sent (false)");
      ch.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: self.user_id, is_typing: false },
      });
    }, 2000);
  }, []);

  const typingUsers = useMemo(() => Object.values(typingMap), [typingMap]);

  return { others, typingUsers, notifyTyping };
}
