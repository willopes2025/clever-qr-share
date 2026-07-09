import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generateCode(len = 8): string {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const formId: string | undefined = body.form_id;
    const staticParams: Record<string, string> = body.static_params || {};
    if (!formId) {
      return new Response(JSON.stringify({ error: "form_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load form (slug + org)
    const { data: form, error: formErr } = await supabase
      .from("forms")
      .select("id, slug, user_id")
      .eq("id", formId)
      .maybeSingle();
    if (formErr || !form) {
      return new Response(JSON.stringify({ error: "Formulário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve caller's organization for RLS INSERT check
    const { data: orgIdRaw } = await supabase.rpc("resolve_user_organization_id", { _user_id: user.id });
    const organizationId: string | null = (orgIdRaw as any) ?? (form as any).organization_id ?? null;

    // Reuse an existing short link with the same (form_id, shared_by, params) if any
    const paramsJson = JSON.stringify(
      Object.keys(staticParams).sort().reduce<Record<string, string>>((acc, k) => {
        acc[k] = String(staticParams[k]); return acc;
      }, {})
    );

    const { data: existing } = await supabase
      .from("form_short_links")
      .select("code, static_params")
      .eq("form_id", formId)
      .eq("shared_by_user_id", user.id)
      .limit(50);

    const match = (existing || []).find((r: any) => {
      const cur = r.static_params || {};
      const norm = JSON.stringify(
        Object.keys(cur).sort().reduce<Record<string, string>>((acc, k) => {
          acc[k] = String(cur[k]); return acc;
        }, {})
      );
      return norm === paramsJson;
    });

    let code: string | null = match?.code ?? null;

    if (!code) {
      // Insert with retry on unique-collision
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = generateCode(8);
        const { data: inserted, error: insErr } = await supabase
          .from("form_short_links")
          .insert({
            code: candidate,
            form_id: formId,
            slug: (form as any).slug,
            static_params: staticParams,
            shared_by_user_id: user.id,
            organization_id: organizationId,
          })
          .select("code")
          .maybeSingle();
        if (!insErr && inserted?.code) {
          code = inserted.code;
          break;
        }
        // If not a unique-violation, surface the error
        if (insErr && !/duplicate|unique/i.test(insErr.message)) {
          return new Response(JSON.stringify({ error: insErr.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      if (!code) {
        return new Response(JSON.stringify({ error: "Falha ao gerar código único" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-form-short-link] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
