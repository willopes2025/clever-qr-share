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
 * Uses getUser() which properly validates the JWT with Supabase Auth.
 * 
 * @param req - The incoming request
 * @returns Object with userId and email on success, or error Response on failure
 */
export async function requireUser(req: Request): Promise<AuthResult> {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Create client with the auth header - this allows getUser() to validate the token
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  // getUser() validates the JWT and returns the user
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error("[auth] User validation failed:", userError?.message || "No user");
    return {
      success: false,
      error: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    };
  }

  return {
    success: true,
    userId: user.id,
    email: user.email
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
