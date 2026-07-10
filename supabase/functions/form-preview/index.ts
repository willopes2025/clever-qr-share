// Serves an HTML page with per-form Open Graph tags for a short-link code
// so link previews (WhatsApp, Telegram, iMessage, etc.) show the form's
// own title/description/image instead of the platform defaults.
// Users are redirected instantly (meta refresh + JS) to the SPA short link.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function encodeStaticPath(staticParams: Record<string, unknown> = {}): string {
  return Object.entries(staticParams)
    .filter(([key, value]) => key && value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("/");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Support /form-preview/CODE and /form-preview?c=CODE
    const parts = url.pathname.split("/").filter(Boolean);
    const code = url.searchParams.get("c") || parts[parts.length - 1];
    const origin = url.searchParams.get("o") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let title = "Formulário";
    let description = "Preencha o formulário para continuar.";
    let image = "";
    let redirectPath = "";

    if (code) {
      const { data: link } = await supabase
        .from("form_short_links")
        .select("form_id, slug, static_params, shared_by_user_id")
        .eq("code", code)
        .maybeSingle();

      if (link) {
        const { data: form } = await supabase
          .from("forms")
          .select("name, page_title, meta_description, og_image_url, logo_url, description")
          .eq("id", (link as any).form_id)
          .maybeSingle();

        if (form) {
          title = (form as any).page_title || (form as any).name || title;
          description = (form as any).meta_description || (form as any).description || description;
          image = (form as any).og_image_url || (form as any).logo_url || "";
        }
        const paramsPath = encodeStaticPath(((link as any).static_params || {}) as Record<string, unknown>);
        const query = new URLSearchParams();
        if ((link as any).shared_by_user_id) query.set("shared_by", String((link as any).shared_by_user_id));
        redirectPath = `/f/${encodeURIComponent((link as any).slug)}${paramsPath ? `/${paramsPath}` : ""}${query.toString() ? `?${query.toString()}` : ""}`;

        supabase.rpc("increment_form_short_link_click", { _code: code }).then(
          () => {},
          () => {},
        );
      }
    }

    const target = origin && redirectPath ? `${origin}${redirectPath}` : (redirectPath || "/");
    const safeTitle = esc(title);
    const safeDesc = esc(description);
    const safeImage = esc(image);
    const safeTarget = esc(target);

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ""}
<meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
${safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : ""}
<meta http-equiv="refresh" content="0; url=${safeTarget}" />
<link rel="canonical" href="${safeTarget}" />
<script>window.location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p>Abrindo formulário... <a href="${safeTarget}">Clique aqui se não for redirecionado.</a></p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("[form-preview] error", e);
    return new Response("Erro ao carregar preview", { status: 500, headers: corsHeaders });
  }
});
