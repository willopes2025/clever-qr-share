import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const actionParam = url.searchParams.get('action');
    
    // For callback, action comes from URL params
    if (actionParam === 'callback') {
      return await handleCallback(url);
    }

    // For other actions, parse from body
    const body = await req.json();
    const { action, task } = body;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader && action !== 'callback') {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'authorize':
        return handleAuthorize(user.id);
      case 'sync-event':
        return await handleSyncEvent(supabase, user.id, task);
      case 'delete-event':
        return await handleDeleteEvent(supabase, user.id, task);
      case 'list-events':
        return await handleListEvents(supabase, user.id, body);
      case 'refresh-token':
        return await handleRefreshToken(supabase, user.id);
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function handleAuthorize(userId: string) {
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', userId);

  return new Response(
    JSON.stringify({ authUrl: authUrl.toString() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCallback(url: URL) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // userId
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      `<html><body><script>window.location.href='/calendar?error=${encodeURIComponent(error)}';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new Response(
      `<html><body><script>window.location.href='/calendar?error=missing_params';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token error:', tokens);
      return new Response(
        `<html><body><script>window.location.href='/calendar?error=${encodeURIComponent(tokens.error)}';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Save to database using service role
    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upsert integration record
    const { error: upsertError } = await supabaseAdmin
      .from('google_calendar_integrations')
      .upsert({
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        calendar_id: 'primary',
        is_active: true,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(
        `<html><body><script>window.location.href='/calendar?error=save_failed';</script></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Redirect back to calendar page with success
    return new Response(
      `<html><body><script>window.location.href='/calendar?google_connected=true&email=${encodeURIComponent(userInfo.email || '')}';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err) {
    console.error('Callback error:', err);
    return new Response(
      `<html><body><script>window.location.href='/calendar?error=callback_failed';</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function getValidToken(supabase: any, userId: string) {
  const { data: integration, error } = await supabase
    .from('google_calendar_integrations')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !integration) {
    throw new Error('Integração não encontrada');
  }

  // Check if token is expired
  const expiresAt = new Date(integration.token_expires_at);
  if (expiresAt <= new Date()) {
    // Refresh the token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: integration.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error('Falha ao renovar token');
    }

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update tokens in database
    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseAdmin
      .from('google_calendar_integrations')
      .update({
        access_token: tokens.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq('user_id', userId);

    return tokens.access_token;
  }

  return integration.access_token;
}

async function handleSyncEvent(supabase: any, userId: string, task: any) {
  const accessToken = await getValidToken(supabase, userId);

  const { data: integration } = await supabase
    .from('google_calendar_integrations')
    .select('calendar_id')
    .eq('user_id', userId)
    .single();

  const calendarId = integration?.calendar_id || 'primary';

  // Build event object
  const startDateTime = task.due_time 
    ? `${task.due_date}T${task.due_time}:00`
    : task.due_date;
  
  const endDateTime = task.due_time
    ? `${task.due_date}T${String(parseInt(task.due_time.split(':')[0]) + 1).padStart(2, '0')}:${task.due_time.split(':')[1]}:00`
    : task.due_date;

  const eventBody: any = {
    summary: task.title,
    description: task.description || '',
  };

  if (task.due_time) {
    eventBody.start = { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' };
    eventBody.end = { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' };
  } else {
    eventBody.start = { date: task.due_date };
    eventBody.end = { date: task.due_date };
  }

  let response;
  let eventId;

  // Check if task already has a google_event_id (update) or not (create)
  const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
  
  const { data: existingTask } = await supabase
    .from(table)
    .select('google_event_id')
    .eq('id', task.id)
    .single();

  if (existingTask?.google_event_id) {
    // Update existing event
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${existingTask.google_event_id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );
    eventId = existingTask.google_event_id;
  } else {
    // Create new event
    response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    const eventData = await response.json();
    
    if (!response.ok) {
      throw new Error(eventData.error?.message || 'Erro ao criar evento');
    }

    eventId = eventData.id;

    // Update task with google_event_id
    await supabase
      .from(table)
      .update({ google_event_id: eventId, sync_with_google: true })
      .eq('id', task.id);
  }

  return new Response(
    JSON.stringify({ success: true, eventId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteEvent(supabase: any, userId: string, task: any) {
  const accessToken = await getValidToken(supabase, userId);

  const { data: integration } = await supabase
    .from('google_calendar_integrations')
    .select('calendar_id')
    .eq('user_id', userId)
    .single();

  const calendarId = integration?.calendar_id || 'primary';

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${task.google_event_id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Erro ao deletar evento');
  }

  // Remove google_event_id from task
  const table = task.source === 'deal' ? 'deal_tasks' : 'conversation_tasks';
  await supabase
    .from(table)
    .update({ google_event_id: null, sync_with_google: false })
    .eq('id', task.id);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListEvents(supabase: any, userId: string, body: any) {
  const accessToken = await getValidToken(supabase, userId);

  const { data: integration } = await supabase
    .from('google_calendar_integrations')
    .select('calendar_id')
    .eq('user_id', userId)
    .single();

  const calendarId = integration?.calendar_id || 'primary';
  const timeMin = body.timeMin || new Date().toISOString();
  const timeMax = body.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro ao listar eventos');
  }

  return new Response(
    JSON.stringify({ success: true, events: data.items }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRefreshToken(supabase: any, userId: string) {
  try {
    const accessToken = await getValidToken(supabase, userId);
    return new Response(
      JSON.stringify({ success: true, accessToken }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
