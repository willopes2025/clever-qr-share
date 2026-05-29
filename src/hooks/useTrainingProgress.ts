import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export const useTrainingProgress = () => {
  const { user } = useAuthContext();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setCompleted(new Set());
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("training_progress")
      .select("step_id")
      .eq("user_id", user.id);
    if (!error && data) {
      setCompleted(new Set(data.map((r) => r.step_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (stepId: string) => {
      if (!user) return;
      const isDone = completed.has(stepId);
      // optimistic
      setCompleted((prev) => {
        const next = new Set(prev);
        if (isDone) next.delete(stepId);
        else next.add(stepId);
        return next;
      });
      if (isDone) {
        await supabase
          .from("training_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("step_id", stepId);
      } else {
        await supabase
          .from("training_progress")
          .insert({ user_id: user.id, step_id: stepId });
      }
    },
    [user, completed],
  );

  return { completed, loading, toggle };
};
