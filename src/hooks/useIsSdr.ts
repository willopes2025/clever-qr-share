import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useIsSdr = () => {
  const { user, loading: authLoading } = useAuth();
  const [isSdr, setIsSdr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) {
          setIsSdr(false);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_sdr" as any, {
          _user_id: user.id,
        });
        if (cancelled) return;
        if (error) {
          console.warn("[useIsSdr] error:", error.message);
          setIsSdr(false);
        } else {
          setIsSdr(data === true);
        }
      } catch (err) {
        if (!cancelled) setIsSdr(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isSdr, loading };
};
