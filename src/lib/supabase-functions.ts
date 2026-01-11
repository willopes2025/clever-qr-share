import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvokeOptions {
  body?: unknown;
}

interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

/**
 * Helper to invoke Supabase Edge Functions with proper authentication.
 * Automatically includes the Authorization header from the current session.
 * Shows appropriate error messages for auth failures.
 */
export async function invokeFunctionWithAuth<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  try {
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error(`[invokeFunctionWithAuth] Session error:`, sessionError);
      return { data: null, error: new Error('Erro ao obter sessão') };
    }
    
    const session = sessionData?.session;
    
    if (!session?.access_token) {
      console.warn(`[invokeFunctionWithAuth] No access token available`);
      return { data: null, error: new Error('Sessão expirada. Faça login novamente.') };
    }
    
    // Invoke function with auth header
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body: options.body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    
    if (error) {
      const errorMessage = (error as any)?.message ?? String(error);
      
      // Check if it's an auth error
      const isAuthError = /auth|session|jwt|unauthorized|401/i.test(errorMessage);
      
      if (isAuthError) {
        console.warn(`[invokeFunctionWithAuth] Auth error for ${functionName}:`, errorMessage);
        
        // Try to refresh session once
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error(`[invokeFunctionWithAuth] Failed to refresh session:`, refreshError);
          return { data: null, error: new Error('Sessão expirada. Faça login novamente.') };
        }
        
        // Retry with refreshed session
        const { data: retrySessionData } = await supabase.auth.getSession();
        const retrySession = retrySessionData?.session;
        
        if (!retrySession?.access_token) {
          return { data: null, error: new Error('Sessão expirada. Faça login novamente.') };
        }
        
        const { data: retryData, error: retryError } = await supabase.functions.invoke<T>(functionName, {
          body: options.body,
          headers: {
            Authorization: `Bearer ${retrySession.access_token}`,
          },
        });
        
        if (retryError) {
          return { data: null, error: retryError };
        }
        
        return { data: retryData, error: null };
      }
      
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    console.error(`[invokeFunctionWithAuth] Unexpected error:`, err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Helper for admin functions - same as invokeFunctionWithAuth but with
 * better error messages for permission errors.
 */
export async function invokeAdminFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  const result = await invokeFunctionWithAuth<T>(functionName, options);
  
  if (result.error) {
    const errorMessage = result.error.message;
    
    // Check for permission errors
    if (/unauthorized|admin|permission|403/i.test(errorMessage)) {
      return { data: null, error: new Error('Acesso negado. Permissão de administrador necessária.') };
    }
  }
  
  // Check for error in response data
  if (result.data && typeof result.data === 'object' && 'error' in result.data) {
    const dataError = (result.data as any).error;
    if (typeof dataError === 'string') {
      return { data: null, error: new Error(dataError) };
    }
  }
  
  return result;
}
