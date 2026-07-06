import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import jsPDF from "npm:jspdf@2.5.1";
import autoTable from "npm:jspdf-autotable@3.8.2";
import { resolveOrgFormatConfig, formatDateSmart } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Source = "contacts" | "deals" | "form_submissions" | "tags_stage";

interface PeriodConfig {
  preset?:
    | "today"
    | "yesterday"
    | "tomorrow"
    | "last_3d"
    | "last_7d"
    | "last_30d"
    | "next_7d"
    | "this_month"
    | "last_month"
    | "custom";
  custom_start?: string; // ISO
  custom_end?: string;   // ISO
}

interface FilterConfig {
  // contacts / deals custom-field filter
  field_key?: string;
  // form
  form_id?: string;
  // tags_stage
  funnel_id?: string;
  stage_id?: string;
  tag_ids?: string[];
  // deals extra
  deal_funnel_id?: string;
}

interface RequestBody {
  mode: "preview" | "run";
  report_id?: string;
  // ad-hoc preview payload
  source?: Source;
  filter_config?: FilterConfig;
  period_config?: PeriodConfig;
  columns?: string[];
}

// ----- Period resolver -----
function resolvePeriod(preset: string | undefined, custom_start?: string, custom_end?: string): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (preset) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "tomorrow": {
      const t = new Date(now); t.setDate(t.getDate() + 1);
      return { start: startOfDay(t), end: endOfDay(t) };
    }
    case "last_3d": {
      const s = new Date(now); s.setDate(s.getDate() - 3);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "last_7d": {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "last_30d": {
      const s = new Date(now); s.setDate(s.getDate() - 30);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "next_7d": {
      const e = new Date(now); e.setDate(e.getDate() + 7);
      return { start: startOfDay(now), end: endOfDay(e) };
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "custom": {
      const s = custom_start ? new Date(custom_start) : startOfDay(now);
      const e = custom_end ? new Date(custom_end) : endOfDay(now);
      return { start: s, end: e };
    }
    default: {
      const s = new Date(now); s.setDate(s.getDate() - 7);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
  }
}

async function getOrgUserIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.rpc("get_organization_member_ids", { _user_id: userId });
  const ids: string[] = Array.isArray(data) ? data.map((r: any) => (typeof r === "string" ? r : r.get_organization_member_ids ?? r)) : [];
  return ids.length ? ids : [userId];
}

// ----- Data fetchers -----
async function fetchContacts(supabase: any, orgUserIds: string[], filter: FilterConfig, start: Date, end: Date) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  let query = supabase.from("contacts")
    .select("id, name, phone, email, custom_fields, created_at")
    .in("user_id", orgUserIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (filter.field_key) {
    // Filter by custom field date value between start and end
    // custom_fields is jsonb; we compare stringified ISO date/date-only.
    // Use RPC-style filter via `contains` fallback with client-side filter for range.
    // Because supabase-js has limited jsonb ops here, we fetch a wider set and filter in code.
  } else {
    query = query.gte("created_at", startIso).lte("created_at", endIso);
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows: any[] = data ?? [];

  if (filter.field_key) {
    rows = rows.filter((c) => {
      const raw = c?.custom_fields?.[filter.field_key!];
      if (!raw) return false;
      const t = new Date(String(raw)).getTime();
      if (Number.isNaN(t)) return false;
      return t >= start.getTime() && t <= end.getTime();
    });
  }

  return rows;
}

async function fetchDeals(supabase: any, orgUserIds: string[], filter: FilterConfig, start: Date, end: Date) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  let query = supabase.from("funnel_deals")
    .select("id, title, value, contact_id, funnel_id, stage_id, custom_fields, created_at, expected_close_date, contact:contacts(id, name, phone), funnel:funnels(id, name), stage:funnel_stages(id, name)")
    .in("user_id", orgUserIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (filter.deal_funnel_id) query = query.eq("funnel_id", filter.deal_funnel_id);
  if (filter.stage_id) query = query.eq("stage_id", filter.stage_id);

  if (!filter.field_key) {
    query = query.gte("created_at", startIso).lte("created_at", endIso);
  }
  const { data, error } = await query;
  if (error) throw error;
  let rows: any[] = data ?? [];
  if (filter.field_key) {
    rows = rows.filter((d) => {
      const raw = d?.custom_fields?.[filter.field_key!];
      if (!raw) return false;
      const t = new Date(String(raw)).getTime();
      if (Number.isNaN(t)) return false;
      return t >= start.getTime() && t <= end.getTime();
    });
  }
  return rows;
}

async function fetchFormSubmissions(supabase: any, orgUserIds: string[], filter: FilterConfig, start: Date, end: Date) {
  if (!filter.form_id) return [];
  const { data, error } = await supabase.from("form_submissions")
    .select("id, form_id, contact_id, user_id, data, created_at, contact:contacts(id, name, phone, email)")
    .in("user_id", orgUserIds)
    .eq("form_id", filter.form_id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data ?? [];
}

async function fetchTagsStage(supabase: any, orgUserIds: string[], filter: FilterConfig, start: Date, end: Date) {
  // If stage_id → deals in that stage created in period
  if (filter.stage_id) {
    const { data, error } = await supabase.from("funnel_deals")
      .select("id, title, value, contact_id, funnel_id, stage_id, created_at, contact:contacts(id, name, phone), stage:funnel_stages(id, name)")
      .in("user_id", orgUserIds)
      .eq("stage_id", filter.stage_id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .limit(2000);
    if (error) throw error;
    return data ?? [];
  }
  // If tag_ids → contact_tags join
  if (filter.tag_ids?.length) {
    const { data, error } = await supabase.from("contact_tags")
      .select("contact:contacts(id, name, phone, email, created_at, user_id), tag_id, created_at")
      .in("tag_id", filter.tag_ids)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .limit(2000);
    if (error) throw error;
    const rows = (data ?? []).filter((r: any) => r?.contact && orgUserIds.includes(r.contact.user_id));
    return rows;
  }
  return [];
}

// ----- PDF builder -----
function buildPdf(opts: {
  reportName: string;
  periodLabel: string;
  rows: any[];
  source: Source;
  columns: string[];
  formatDate: (v: any) => string;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(opts.reportName, 40, 28);
  doc.setFontSize(10);
  doc.text(opts.periodLabel, 40, 46);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(10);
  doc.text(`Total: ${opts.rows.length} registros`, 40, 80);

  const { head, body } = buildTable(opts.source, opts.rows, opts.columns, opts.formatDate);
  autoTable(doc, {
    startY: 100,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

function buildTable(source: Source, rows: any[], columns: string[], fmt: (v: any) => string) {
  const cols = columns.length ? columns : DEFAULT_COLUMNS[source];
  const head = cols.map((c) => LABELS[c] ?? c);
  const body = rows.map((r) => cols.map((c) => extract(source, r, c, fmt)));
  return { head, body };
}

const DEFAULT_COLUMNS: Record<Source, string[]> = {
  contacts: ["name", "phone", "email", "created_at"],
  deals: ["title", "value", "contact_name", "stage", "created_at"],
  form_submissions: ["contact_name", "contact_phone", "data_summary", "created_at"],
  tags_stage: ["contact_name", "contact_phone", "created_at"],
};

const LABELS: Record<string, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  created_at: "Criado em",
  title: "Título",
  value: "Valor",
  contact_name: "Contato",
  contact_phone: "Telefone",
  stage: "Etapa",
  funnel: "Funil",
  data_summary: "Respostas",
  custom_field_value: "Campo",
};

function extract(source: Source, row: any, col: string, fmt: (v: any) => string): string {
  const contact = row?.contact ?? row;
  switch (col) {
    case "name": return String(row.name ?? "");
    case "phone": return String(row.phone ?? "");
    case "email": return String(row.email ?? "");
    case "created_at": return fmt(row.created_at);
    case "title": return String(row.title ?? "");
    case "value":
      return typeof row.value === "number"
        ? row.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "";
    case "contact_name": return String(contact?.name ?? "");
    case "contact_phone": return String(contact?.phone ?? "");
    case "stage": return String(row?.stage?.name ?? "");
    case "funnel": return String(row?.funnel?.name ?? "");
    case "data_summary": {
      if (!row.data || typeof row.data !== "object") return "";
      const entries = Object.entries(row.data).slice(0, 4)
        .map(([k, v]) => `${k}: ${String(v)}`).join(" | ");
      return entries;
    }
    default:
      if (col.startsWith("cf:")) {
        const key = col.slice(3);
        return String(row?.custom_fields?.[key] ?? "");
      }
      return "";
  }
}

// ----- WhatsApp delivery -----
async function sendWhatsAppMessage(supabase: any, ownerUserId: string, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { data: instance } = await supabase.from("whatsapp_instances")
    .select("evolution_instance_name, status")
    .eq("user_id", ownerUserId)
    .eq("status", "connected")
    .neq("is_notification_only", true)
    .limit(1)
    .maybeSingle();
  if (!instance?.evolution_instance_name) {
    return { ok: false, error: "Nenhuma instância WhatsApp conectada" };
  }
  const evoUrl = Deno.env.get("EVOLUTION_API_URL");
  const evoKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evoUrl || !evoKey) return { ok: false, error: "EVOLUTION_API_URL/EVOLUTION_API_KEY não configurados" };

  const url = `${evoUrl.replace(/\/$/, "")}/message/sendText/${instance.evolution_instance_name}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: JSON.stringify({ number: phone, text: message }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("authorization");
    const internalSecret = req.headers.get("x-internal-secret");
    let effectiveUserId: string | null = null;

    if (internalSecret && internalSecret === serviceKey) {
      // Trusted internal caller (scheduler). Use the report owner as the acting user.
      effectiveUserId = "__internal__";
    } else {
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      effectiveUserId = user.id;
    }

    const body: RequestBody = await req.json();
    const mode = body.mode || "preview";

    // Resolve config source: from report_id (saved) or ad-hoc payload
    let source: Source;
    let filter_config: FilterConfig;
    let period_config: PeriodConfig;
    let columns: string[];
    let reportName = "Relatório";
    let reportRow: any = null;

    if (body.report_id) {
      const { data: r, error } = await supabase.from("dynamic_reports").select("*").eq("id", body.report_id).maybeSingle();
      if (error || !r) throw new Error("Relatório não encontrado");
      reportRow = r;
      source = r.source;
      filter_config = r.filter_config || {};
      period_config = r.period_config || { preset: "last_7d" };
      columns = r.columns || [];
      reportName = r.name;
    } else {
      if (effectiveUserId === "__internal__") throw new Error("Modo interno exige report_id");
      source = (body.source || "contacts") as Source;
      filter_config = body.filter_config || {};
      period_config = body.period_config || { preset: "last_7d" };
      columns = body.columns || [];
    }

    // Resolve acting user: for internal scheduler calls, the report owner is the acting user.
    const actingUserId = effectiveUserId === "__internal__" ? (reportRow?.user_id as string) : effectiveUserId!;

    const orgUserIds = await getOrgUserIds(supabase, actingUserId);
    const { start, end } = resolvePeriod(period_config.preset, period_config.custom_start, period_config.custom_end);

    let rows: any[] = [];
    if (source === "contacts") rows = await fetchContacts(supabase, orgUserIds, filter_config, start, end);
    else if (source === "deals") rows = await fetchDeals(supabase, orgUserIds, filter_config, start, end);
    else if (source === "form_submissions") rows = await fetchFormSubmissions(supabase, orgUserIds, filter_config, start, end);
    else if (source === "tags_stage") rows = await fetchTagsStage(supabase, orgUserIds, filter_config, start, end);

    const fmtCfg = await resolveOrgFormatConfig(supabase, { userId: actingUserId });
    const fmt = (v: any) => formatDateSmart(v, fmtCfg);

    if (mode === "preview") {
      const preview = rows.slice(0, 100);
      return new Response(JSON.stringify({
        row_count: rows.length,
        preview,
        period: { start: start.toISOString(), end: end.toISOString() },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- RUN ----
    if (!reportRow) throw new Error("mode=run requer report_id");

    const periodLabel = `${fmt(start.toISOString())} — ${fmt(end.toISOString())}`;
    const pdfBytes = buildPdf({ reportName, periodLabel, rows, source, columns, formatDate: fmt });

    // Insert run row first to get id
    const { data: runRow, error: runErr } = await supabase.from("dynamic_report_runs").insert({
      report_id: reportRow.id,
      triggered_by: actingUserId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      row_count: rows.length,
      status: "success",
    }).select().single();
    if (runErr || !runRow) throw new Error(`Falha ao registrar execução: ${runErr?.message}`);

    const orgId = reportRow.organization_id || "no-org";
    const storagePath = `org/${orgId}/${reportRow.id}/${runRow.id}.pdf`;
    const upload = await supabase.storage.from("dynamic-reports").upload(storagePath, new Uint8Array(pdfBytes as any), {
      contentType: "application/pdf", upsert: true,
    });
    if (upload.error) {
      await supabase.from("dynamic_report_runs").update({ status: "failed", error: upload.error.message }).eq("id", runRow.id);
      throw new Error(`Upload do PDF falhou: ${upload.error.message}`);
    }

    await supabase.from("dynamic_report_runs").update({ pdf_storage_path: storagePath }).eq("id", runRow.id);

    // Notify recipients
    const { data: recipients } = await supabase.from("dynamic_report_recipients")
      .select("user_id, channels").eq("report_id", reportRow.id);

    const deliveryLog: any[] = [];
    if (recipients?.length) {
      // signed URL for the PDF
      const { data: signed } = await supabase.storage.from("dynamic-reports").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      const pdfUrl = signed?.signedUrl;

      for (const rec of recipients) {
        if (rec.channels?.includes("whatsapp")) {
          const { data: prof } = await supabase.from("profiles").select("phone, full_name").eq("id", rec.user_id).maybeSingle();
          if (prof?.phone) {
            const msg = `📊 *${reportName}*\nPeríodo: ${periodLabel}\nRegistros: ${rows.length}\n\n📎 Baixar PDF:\n${pdfUrl}`;
            const res = await sendWhatsAppMessage(supabase, reportRow.user_id, prof.phone, msg);
            deliveryLog.push({ user_id: rec.user_id, channel: "whatsapp", ok: res.ok, error: res.error });
          } else {
            deliveryLog.push({ user_id: rec.user_id, channel: "whatsapp", ok: false, error: "Sem telefone no perfil" });
          }
        }
        // bell entries are handled by realtime subscription on dynamic_report_runs on the frontend
        if (rec.channels?.includes("bell")) {
          deliveryLog.push({ user_id: rec.user_id, channel: "bell", ok: true });
        }
      }
    }

    await supabase.from("dynamic_report_runs").update({ delivery_log: deliveryLog }).eq("id", runRow.id);

    return new Response(JSON.stringify({
      run_id: runRow.id,
      row_count: rows.length,
      pdf_path: storagePath,
      delivery_log: deliveryLog,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[run-dynamic-report] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
