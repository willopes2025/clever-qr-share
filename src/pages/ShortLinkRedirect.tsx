import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a short link (/s/:code) and redirects to the full form URL,
 * preserving static params and attaching `shared_by` for attribution.
 */
const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("form_short_links")
        .select("slug, static_params, shared_by_user_id")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setError("Link inválido ou expirado.");
        return;
      }

      // Fire-and-forget click counter
      supabase.rpc("increment_form_short_link_click", { _code: code }).then(
        () => {},
        () => {},
      );

      const staticParams = (data.static_params as Record<string, string>) || {};
      const pathParts: string[] = [`/form/${data.slug}`];
      const paramSegments = Object.entries(staticParams).map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      );
      if (paramSegments.length > 0) pathParts.push(paramSegments.join("/"));

      const query = new URLSearchParams();
      if (data.shared_by_user_id) query.set("shared_by", String(data.shared_by_user_id));
      const qs = query.toString();

      const target = `${pathParts.join("/")}${qs ? `?${qs}` : ""}`;
      window.location.replace(target);
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Link inválido</h1>
            <p className="text-muted-foreground">{error}</p>
          </>
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
