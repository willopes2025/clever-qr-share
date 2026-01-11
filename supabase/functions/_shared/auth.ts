import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthSuccess {
  success: true;
  userId: string;
  email: string | undefined;
}

interface AuthFailure {
  success: false;
  error: Response;
}

type AuthResult = AuthSuccess | AuthFailure;

/**
 * Validates the Authorization header and returns the authenticated user.
 * Uses getClaims() to validate the JWT with signing keys (recommended for Edge Functions).
 *
 * @param req - The incoming request
 * @returns Object with userId and email on success, or error Response on failure
 */
export async function requireUser(req: Request, maxRetries = 2): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("[auth] Missing or invalid authorization header");
    return {
      success: false,
      error: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });

      const { data, error } = await supabaseClient.auth.getClaims(token);

      if (!error && data?.claims?.sub) {
        const userId = data.claims.sub;
        const email = (data.claims as Record<string, unknown>)?.email as string | undefined;

        if (email !== undefined) {
          if (attempt > 1) console.log(`[auth] Succeeded on attempt ${attempt}`);
          return { success: true, userId, email };
        }

        // Fallback: email may not be present in some identities' JWT claims.
        const serviceClient = createServiceClient();
        const { data: userData, error: adminError } = await serviceClient.auth.admin.getUserById(userId);

        if (!adminError) {
          if (attempt > 1) console.log(`[auth] Succeeded on attempt ${attempt}`);
          return { success: true, userId, email: userData.user?.email };
        }

        lastError = adminError;
      } else {
        lastError = error ?? new Error("No claims returned");
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    console.warn(`[auth] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }

  console.error("[auth] All attempts failed:", lastError?.message);
  return {
    success: false,
    error: new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  };
}

/**
 * Creates a service role Supabase client for admin operations.
 * This bypasses RLS and should only be used after user authentication.
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

/**
 * Checks if the authenticated user has admin role.
 * 
 * @param userId - The authenticated user's ID
 * @returns true if user is admin, false otherwise
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabaseClient = createServiceClient();
  
  // Check using the has_role function
  const { data: isAdminData, error: adminError } = await supabaseClient.rpc('has_role', {
    _user_id: userId,
    _role: 'admin'
  });

  if (adminError) {
    console.error("[auth] Admin check failed:", adminError.message);
    return false;
  }

  return Boolean(isAdminData);
}

export { corsHeaders };
