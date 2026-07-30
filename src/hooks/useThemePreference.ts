import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ThemeMode = "light" | "dark" | "system";

const isValid = (v: unknown): v is ThemeMode =>
  v === "light" || v === "dark" || v === "system";

/**
 * Sincroniza a preferência de tema do usuário com o backend (user_settings.theme).
 * O localStorage (next-themes) segue como cache instantâneo para evitar flash.
 */
export const useThemePreference = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const hydrated = useRef(false);

  // Carrega a preferência salva na conta ao logar
  useEffect(() => {
    if (!user?.id || hydrated.current) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      hydrated.current = true;

      const remote = (data as { theme?: string } | null)?.theme;
      if (isValid(remote) && remote !== theme) {
        setTheme(remote);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, theme, setTheme]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setTheme(mode);
      if (!user?.id) return;

      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_settings")
          .update({ theme: mode })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("user_settings")
          .insert({ user_id: user.id, theme: mode });
      }
    },
    [setTheme, user?.id]
  );

  return {
    theme: (isValid(theme) ? theme : "system") as ThemeMode,
    resolvedTheme: resolvedTheme === "dark" ? "dark" : "light",
    setThemeMode,
  };
};
