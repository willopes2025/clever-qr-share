import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário autenticado
    const { data: { user: adminUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !adminUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin user:", adminUser.id);

    const { email, password, name, role, organizationId } = await req.json();

    // Validar dados
    if (!email || !password || !role || !organizationId) {
      return new Response(
        JSON.stringify({ error: "Email, senha, role e organizationId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente admin com service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar se o usuário admin é dono ou admin da organização
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("owner_id")
      .eq("id", organizationId)
      .single();

    const isOwner = orgData?.owner_id === adminUser.id;

    if (!isOwner) {
      const { data: memberData } = await supabaseAdmin
        .from("team_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", adminUser.id)
        .eq("status", "active")
        .single();

      if (!memberData || memberData.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Sem permissão para criar membros nesta organização" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Creating user with email:", email);

    // Criar usuário com Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma email automaticamente
      user_metadata: { full_name: name || email },
    });

    if (createError) {
      console.error("Create user error:", createError);
      
      if (createError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este email já está registrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created:", newUser.user.id);

    // Definir permissões padrão baseadas na role
    const defaultPermissions = role === "admin" 
      ? {
          // Inbox
          inbox_view: true,
          inbox_reply: true,
          inbox_assign: true,
          inbox_delete: true,
          inbox_ai_assistant: true,
          // Contatos
          contacts_view: true,
          contacts_create: true,
          contacts_edit: true,
          contacts_delete: true,
          contacts_import: true,
          contacts_export: true,
          contacts_manage_tags: true,
          // Templates
          templates_view: true,
          templates_create: true,
          templates_edit: true,
          templates_delete: true,
          // Campanhas
          campaigns_view: true,
          campaigns_create: true,
          campaigns_edit: true,
          campaigns_delete: true,
          campaigns_start: true,
          campaigns_pause: true,
          // Listas de Disparo
          broadcast_lists_view: true,
          broadcast_lists_create: true,
          broadcast_lists_edit: true,
          broadcast_lists_delete: true,
          broadcast_lists_send: true,
          // Funis
          funnels_view: true,
          funnels_create: true,
          funnels_edit: true,
          funnels_delete: true,
          funnels_manage_deals: true,
          funnels_manage_automations: true,
          // Instâncias
          instances_view: true,
          instances_create: true,
          instances_edit: true,
          instances_delete: true,
          instances_connect: true,
          // Aquecimento
          warming_view: true,
          warming_manage: true,
          // Análises
          analysis_view: true,
          analysis_create: true,
          // Busca de Leads
          lead_search_view: true,
          lead_search_execute: true,
          // Configurações
          settings_view: true,
          settings_edit: true,
          settings_team_manage: true,
          settings_billing: true,
        }
      : {
          // Membro padrão - apenas visualização básica
          inbox_view: true,
          inbox_reply: true,
          contacts_view: true,
          templates_view: true,
          campaigns_view: true,
          broadcast_lists_view: true,
          funnels_view: true,
          instances_view: true,
          warming_view: true,
          analysis_view: true,
        };

    // Criar registro em team_members
    const { error: memberError } = await supabaseAdmin
      .from("team_members")
      .insert({
        organization_id: organizationId,
        user_id: newUser.user.id,
        email,
        role,
        permissions: defaultPermissions,
        status: "active",
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("Member insert error:", memberError);
      
      // Tentar deletar o usuário criado se falhar ao criar membro
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      
      if (memberError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Este email já é membro desta organização" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao adicionar membro à equipe" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Member created successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        } 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
