import {
  authenticate,
  createAdminClient,
  enforceRateLimit,
  parseUrl,
  parsePagination,
  normalizePhone,
  isUuid,
  sendSuccess,
  sendError,
  buildMeta,
  corsHeaders,
  type AuthContext,
  type ParsedUrl,
} from "../_shared/public-api.ts";

// ── Gateway da API pública ────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const parsed = parseUrl(req);

    // 1. Autenticação
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;

    // 2. Rate limit
    const rateLimitError = await enforceRateLimit(auth.keyId);
    if (rateLimitError instanceof Response) return rateLimitError;

    // 3. Roteamento
    return await route(parsed, req, auth);
  } catch (err) {
    console.error("[public-api] Unhandled error:", err);
    return sendError(500, "INTERNAL_ERROR", "Erro interno do servidor.");
  }
});

// ── Roteador ──────────────────────────────────────────────────────────────

async function route(parsed: ParsedUrl, req: Request, auth: AuthContext): Promise<Response> {
  const { segments, method } = parsed;

  // GET /v1/contacts
  if (segments[0] === "v1" && segments[1] === "contacts" && segments.length === 2 && method === "GET") {
    return listContacts(parsed, auth);
  }

  // GET /v1/contacts/:id
  if (segments[0] === "v1" && segments[1] === "contacts" && segments.length === 3 && method === "GET") {
    return getContact(segments[2], auth);
  }

  // POST /v1/contacts
  if (segments[0] === "v1" && segments[1] === "contacts" && segments.length === 2 && method === "POST") {
    return createContact(req, auth);
  }

  // PATCH /v1/contacts/:id
  if (segments[0] === "v1" && segments[1] === "contacts" && segments.length === 3 && method === "PATCH") {
    return updateContact(segments[2], req, auth);
  }

  // DELETE /v1/contacts/:id
  if (segments[0] === "v1" && segments[1] === "contacts" && segments.length === 3 && method === "DELETE") {
    return deleteContact(segments[2], auth);
  }

  // GET /v1/leads
  if (segments[0] === "v1" && segments[1] === "leads" && segments.length === 2 && method === "GET") {
    return listLeads(parsed, auth);
  }

  // GET /v1/leads/:id
  if (segments[0] === "v1" && segments[1] === "leads" && segments.length === 3 && method === "GET") {
    return getLead(segments[2], auth);
  }

  // POST /v1/leads
  if (segments[0] === "v1" && segments[1] === "leads" && segments.length === 2 && method === "POST") {
    return createLead(req, auth);
  }

  // PATCH /v1/leads/:id
  if (segments[0] === "v1" && segments[1] === "leads" && segments.length === 3 && method === "PATCH") {
    return updateLead(segments[2], req, auth);
  }

  // DELETE /v1/leads/:id
  if (segments[0] === "v1" && segments[1] === "leads" && segments.length === 3 && method === "DELETE") {
    return deleteLead(segments[2], auth);
  }

  return sendError(404, "NOT_FOUND", "Rota não encontrada.");
}

// ── Handlers: Contatos ────────────────────────────────────────────────────

async function listContacts(parsed: ParsedUrl, auth: AuthContext): Promise<Response> {
  const supabase = createAdminClient();
  const { page, pageSize, limit } = parsePagination(parsed.query);
  const phone = parsed.query.get("phone");
  const name = parsed.query.get("name");

  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (phone) {
    const normalized = normalizePhone(phone);
    query = query.ilike("phone", `%${normalized}%`);
    query = query.limit(limit);
  } else if (name) {
    const escaped = name.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.ilike("name", `%${escaped}%`);
    query = query.limit(limit);
  } else {
    query = query.range(parsed.query.get("page") ? (page - 1) * pageSize : 0,
      (parsed.query.get("page") ? page : 1) * pageSize - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[listContacts] Query error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao buscar contatos.");
  }

  const total = count ?? 0;
  const result = data ?? [];

  if (phone || name) {
    // Busca com filtro: retorna lista com limit
    return sendSuccess(200, result, buildMeta(1, result.length, total, total > result.length, { limit }));
  }

  // Listagem paginada
  return sendSuccess(200, result, buildMeta(page, pageSize, total, page * pageSize < total));
}

async function getContact(id: string, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) {
    return sendError(400, "VALIDATION_ERROR", "ID inválido.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getContact] Query error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao buscar contato.");
  }

  if (!data) return sendError(404, "NOT_FOUND", "Contato não encontrado.");

  return sendSuccess(200, data);
}

async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  const raw = await req.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function createContact(req: Request, auth: AuthContext): Promise<Response> {
  const body = await parseBody(req);
  if (!body) return sendError(400, "VALIDATION_ERROR", "Body inválido.");

  // Validação
  if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
    return sendError(400, "VALIDATION_ERROR", "Campo 'phone' é obrigatório.", { phone: "Obrigatório." });
  }

  if (body.email && typeof body.email === "string" && body.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return sendError(400, "VALIDATION_ERROR", "E-mail inválido.", { email: "Formato inválido." });
    }
  }

  const supabase = createAdminClient();
  const phone = normalizePhone(body.phone.trim());

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: auth.userId,
      phone,
      name: body.name?.trim() || null,
      email: body.email?.trim() || null,
      notes: body.notes?.trim() || null,
      status: body.status === "inactive" ? "inactive" : "active",
      custom_fields: body.custom_fields && typeof body.custom_fields === "object" ? body.custom_fields : {},
      label_id: body.label_id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return sendError(409, "DUPLICATE", "Contato com este telefone já existe.");
    }
    console.error("[createContact] Insert error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao criar contato.");
  }

  return sendSuccess(201, data);
}

async function updateContact(id: string, req: Request, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) return sendError(400, "VALIDATION_ERROR", "ID inválido.");

  const body = await parseBody(req);
  if (!body) return sendError(400, "VALIDATION_ERROR", "Body inválido.");

  const supabase = createAdminClient();

  // Verifica existência
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) return sendError(404, "NOT_FOUND", "Contato não encontrado.");

  // Monta update parcial
  const updates: Record<string, unknown> = {};
  if (body.phone !== undefined) updates.phone = normalizePhone(String(body.phone).trim());
  if (body.name !== undefined) updates.name = body.name?.trim() || null;
  if (body.email !== undefined) updates.email = body.email?.trim() || null;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.status !== undefined) updates.status = body.status === "inactive" ? "inactive" : "active";
  if (body.custom_fields !== undefined && typeof body.custom_fields === "object") {
    updates.custom_fields = body.custom_fields;
  }
  if (body.label_id !== undefined) updates.label_id = body.label_id || null;

  if (Object.keys(updates).length === 0) {
    return sendError(400, "VALIDATION_ERROR", "Nenhum campo para atualizar.");
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return sendError(409, "DUPLICATE", "Contato com este telefone já existe.");
    }
    console.error("[updateContact] Update error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao atualizar contato.");
  }

  return sendSuccess(200, data);
}

async function deleteContact(id: string, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) return sendError(400, "VALIDATION_ERROR", "ID inválido.");

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) return sendError(404, "NOT_FOUND", "Contato não encontrado.");

  const { error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[deleteContact] Soft delete error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao deletar contato.");
  }

  return new Response(null, { status: 204 });
}

// ── Handlers: Leads (funnel_deals) ────────────────────────────────────────

async function listLeads(parsed: ParsedUrl, auth: AuthContext): Promise<Response> {
  const supabase = createAdminClient();
  const { page, pageSize, limit } = parsePagination(parsed.query);
  const phone = parsed.query.get("phone");
  const name = parsed.query.get("name");
  const stageId = parsed.query.get("stage_id");

  // Busca leads com join em contacts para busca por phone/name
  let query = supabase
    .from("funnel_deals")
    .select("*, contact:contacts(*)", { count: "exact" })
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (stageId) {
    query = query.eq("stage_id", stageId);
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    // Busca contatos com phone compatível e pega os deals deles
    const { data: matchingContacts } = await supabase
      .from("contacts")
      .select("id")
      .in("user_id", auth.memberIds)
      .is("deleted_at", null)
      .ilike("phone", `%${normalized}%`)
      .limit(limit);

    if (!matchingContacts || matchingContacts.length === 0) {
      return sendSuccess(200, [], buildMeta(1, 0, 0, false, { limit }));
    }

    const contactIds = matchingContacts.map((c) => c.id);
    query = query.in("contact_id", contactIds).limit(limit);
  } else if (name) {
    const escaped = name.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const { data: matchingContacts } = await supabase
      .from("contacts")
      .select("id")
      .in("user_id", auth.memberIds)
      .is("deleted_at", null)
      .ilike("name", `%${escaped}%`)
      .limit(limit);

    if (!matchingContacts || matchingContacts.length === 0) {
      return sendSuccess(200, [], buildMeta(1, 0, 0, false, { limit }));
    }

    const contactIds = matchingContacts.map((c) => c.id);
    query = query.in("contact_id", contactIds).limit(limit);
  } else {
    // Listagem paginada
    query = query.range(parsed.query.get("page") ? (page - 1) * pageSize : 0,
      (parsed.query.get("page") ? page : 1) * pageSize - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[listLeads] Query error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao buscar leads.");
  }

  const total = count ?? 0;
  const result = data ?? [];

  if (phone || name) {
    return sendSuccess(200, result, buildMeta(1, result.length, total, total > result.length, { limit }));
  }

  return sendSuccess(200, result, buildMeta(page, pageSize, total, page * pageSize < total));
}

async function getLead(id: string, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) return sendError(400, "VALIDATION_ERROR", "ID inválido.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("funnel_deals")
    .select("*, contact:contacts(*)")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getLead] Query error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao buscar lead.");
  }

  if (!data) return sendError(404, "NOT_FOUND", "Lead não encontrado.");

  return sendSuccess(200, data);
}

async function createLead(req: Request, auth: AuthContext): Promise<Response> {
  const body = await parseBody(req);
  if (!body) return sendError(400, "VALIDATION_ERROR", "Body inválido.");

  const supabase = createAdminClient();
  let contactId: string | null = null;

  // ── Modo A: contact_id informado ──
  if (body.contact_id) {
    if (!isUuid(body.contact_id)) {
      return sendError(400, "VALIDATION_ERROR", "contact_id inválido.");
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", body.contact_id)
      .in("user_id", auth.memberIds)
      .is("deleted_at", null)
      .maybeSingle();

    if (!contact) {
      return sendError(422, "UNRELATED_RESOURCE", "Contato não encontrado nesta conta.");
    }

    contactId = contact.id;
  }

  // ── Modo B: criação automática de contato ──
  if (!contactId) {
    if (!body.phone || typeof body.phone !== "string" || !body.phone.trim()) {
      return sendError(400, "VALIDATION_ERROR", "Campo 'phone' é obrigatório quando contact_id não é informado.", { phone: "Obrigatório." });
    }
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return sendError(400, "VALIDATION_ERROR", "Campo 'name' é obrigatório quando contact_id não é informado.", { name: "Obrigatório." });
    }

    const phone = normalizePhone(body.phone.trim());

    // Busca contato existente pelo phone
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("phone", phone)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      // Cria contato
      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          user_id: auth.userId,
          phone,
          name: body.name.trim(),
          email: body.email?.trim() || null,
          notes: body.notes?.trim() || null,
          status: "active",
          custom_fields: {},
        })
        .select("id")
        .single();

      if (createError) {
        if (createError.code === "23505") {
          return sendError(409, "DUPLICATE", "Contato com este telefone já existe.");
        }
        console.error("[createLead] Contact insert error:", createError.message);
        return sendError(500, "INTERNAL_ERROR", "Erro ao criar contato automático.");
      }

      contactId = newContact.id;
    }
  }

  // ── Resolve funil padrão ──
  let funnelId = body.funnel_id;
  let stageId = body.stage_id;

  if (!funnelId || !stageId) {
    // Busca funil padrão
    const { data: funnel } = await supabase
      .from("funnels")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("is_default", true)
      .maybeSingle();

    if (!funnel) {
      // Fallback: primeiro funil do usuário
      const { data: anyFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("user_id", auth.userId)
        .order("display_order")
        .limit(1)
        .maybeSingle();

      if (!anyFunnel) {
        return sendError(422, "FUNNEL_NOT_CONFIGURED", "Conta sem funil configurado. Crie um funil antes de criar leads.");
      }

      funnelId = funnelId ?? anyFunnel.id;
    } else {
      funnelId = funnelId ?? funnel.id;
    }

    // Busca primeiro estágio do funil
    if (!stageId) {
      const { data: stage } = await supabase
        .from("funnel_stages")
        .select("id")
        .eq("funnel_id", funnelId)
        .order("display_order")
        .limit(1)
        .maybeSingle();

      if (!stage) {
        return sendError(422, "FUNNEL_NOT_CONFIGURED", "Funil sem estágios configurados.");
      }

      stageId = stage.id;
    }
  }

  // ── Insere o deal ──
  const { data: deal, error: dealError } = await supabase
    .from("funnel_deals")
    .insert({
      user_id: auth.userId,
      funnel_id: funnelId,
      stage_id: stageId,
      contact_id: contactId,
      title: body.title || null,
      value: typeof body.value === "number" ? body.value : 0,
      currency: body.currency || "BRL",
      expected_close_date: body.expected_close_date || null,
      source: body.source || null,
      notes: body.notes?.trim() || null,
      custom_fields: body.custom_fields && typeof body.custom_fields === "object" ? body.custom_fields : {},
    })
    .select("*, contact:contacts(*)")
    .single();

  if (dealError) {
    console.error("[createLead] Deal insert error:", dealError.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao criar lead.");
  }

  return sendSuccess(201, deal);
}

async function updateLead(id: string, req: Request, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) return sendError(400, "VALIDATION_ERROR", "ID inválido.");

  const body = await parseBody(req);
  if (!body) return sendError(400, "VALIDATION_ERROR", "Body inválido.");

  const supabase = createAdminClient();

  // Verifica existência e pega stage_id atual
  const { data: existing } = await supabase
    .from("funnel_deals")
    .select("id, stage_id")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) return sendError(404, "NOT_FOUND", "Lead não encontrado.");

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title?.trim() || null;
  if (body.value !== undefined) updates.value = typeof body.value === "number" ? body.value : 0;
  if (body.currency !== undefined) updates.currency = body.currency || "BRL";
  if (body.stage_id !== undefined) updates.stage_id = body.stage_id;
  if (body.expected_close_date !== undefined) updates.expected_close_date = body.expected_close_date || null;
  if (body.source !== undefined) updates.source = body.source?.trim() || null;
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.custom_fields !== undefined && typeof body.custom_fields === "object") {
    updates.custom_fields = body.custom_fields;
  }

  if (Object.keys(updates).length === 0) {
    return sendError(400, "VALIDATION_ERROR", "Nenhum campo para atualizar.");
  }

  const { data, error } = await supabase
    .from("funnel_deals")
    .update(updates)
    .eq("id", id)
    .select("*, contact:contacts(*)")
    .single();

  if (error) {
    console.error("[updateLead] Update error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao atualizar lead.");
  }

  // Se stage_id mudou, registra no histórico
  if (body.stage_id && body.stage_id !== existing.stage_id) {
    await supabase.from("funnel_deal_history").insert({
      deal_id: id,
      from_stage_id: existing.stage_id,
      to_stage_id: body.stage_id,
      changed_at: new Date().toISOString(),
      notes: "Atualizado via API pública",
    });
  }

  return sendSuccess(200, data);
}

async function deleteLead(id: string, auth: AuthContext): Promise<Response> {
  if (!isUuid(id)) return sendError(400, "VALIDATION_ERROR", "ID inválido.");

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("funnel_deals")
    .select("id")
    .eq("id", id)
    .in("user_id", auth.memberIds)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) return sendError(404, "NOT_FOUND", "Lead não encontrado.");

  const { error } = await supabase
    .from("funnel_deals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[deleteLead] Soft delete error:", error.message);
    return sendError(500, "INTERNAL_ERROR", "Erro ao deletar lead.");
  }

  return new Response(null, { status: 204 });
}
