import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildDirectFormUrl } from "@/lib/form-share-links";

/**
 * Resolves a short link (/s/:code) directly to the SPA form URL,
 * preserving static params and attaching `shared_by` for attribution.
 */
const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("form_short_links")
          .select("slug, static_params, shared_by_user_id")
          .eq("code", code)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setError("Link inválido ou expirado.");
          return;
        }

        const staticParams = (data.static_params ?? {}) as Record<string, string>;
        const baseUrl = buildDirectFormUrl(data.slug, staticParams);
        const url = new URL(baseUrl);
        if (data.shared_by_user_id) {
          url.searchParams.set("shared_by", String(data.shared_by_user_id));
        }

        // Best-effort click tracking
        supabase.rpc("increment_form_short_link_click", { _code: code }).then(
          () => {},
          () => {},
        );

        window.location.replace(url.toString());
      } catch (e: any) {
        console.error("[ShortLinkRedirect]", e);
        if (!cancelled) setError("Não foi possível abrir o formulário.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <>
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Abrindo formulário...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ShortLinkRedirect;
