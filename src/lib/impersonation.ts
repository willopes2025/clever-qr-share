import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "impersonation_state";

export interface ImpersonationState {
  adminAccessToken: string;
  adminRefreshToken: string;
  adminEmail: string | null;
  targetEmail: string;
  logId: string | null;
}

export function getImpersonationState(): ImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

function setImpersonationState(state: ImpersonationState | null) {
  if (state) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  else sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("impersonation-changed"));
}

/** Starts impersonating a user. Replaces the current browser session. */
export async function startImpersonation(targetUserId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const current = sessionData.session;
  if (!current) throw new Error("Sessão do administrador não encontrada");

  const { data, error } = await supabase.functions.invoke("admin-impersonate-user", {
    body: { action: "start", targetUserId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data?.token_hash) throw new Error("Token de acesso não retornado");

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash as string,
    type: "magiclink",
  });
  if (otpError) throw new Error(otpError.message);

  setImpersonationState({
    adminAccessToken: current.access_token,
    adminRefreshToken: current.refresh_token,
    adminEmail: current.user?.email ?? null,
    targetEmail: data.email as string,
    logId: (data.logId as string | null) ?? null,
  });
}

/** Restores the original admin session. */
export async function stopImpersonation() {
  const state = getImpersonationState();
  if (!state) return;

  const { error } = await supabase.auth.setSession({
    access_token: state.adminAccessToken,
    refresh_token: state.adminRefreshToken,
  });

  setImpersonationState(null);

  if (state.logId) {
    // Best-effort audit close, now back as the admin
    supabase.functions
      .invoke("admin-impersonate-user", { body: { action: "end", logId: state.logId } })
      .catch(() => undefined);
  }

  if (error) throw new Error(error.message);
}
