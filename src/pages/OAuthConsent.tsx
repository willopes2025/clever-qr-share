import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import wideLogo from "@/assets/wide-logo.png";

// Narrow local typings for the beta supabase.auth.oauth namespace.
type OAuthAuthDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthClient = {
  auth: {
    oauth: {
      getAuthorizationDetails: (
        id: string,
      ) => Promise<{ data: OAuthAuthDetails | null; error: { message: string } | null }>;
      approveAuthorization: (
        id: string,
      ) => Promise<{ data: OAuthAuthDetails | null; error: { message: string } | null }>;
      denyAuthorization: (
        id: string,
      ) => Promise<{ data: OAuthAuthDetails | null; error: { message: string } | null }>;
    };
  };
};

const oauthClient = supabase as unknown as OAuthClient;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("authorization_id ausente na URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: detailsError } = await oauthClient.auth.oauth.getAuthorizationDetails(
        authorizationId,
      );
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decideError } = approve
      ? await oauthClient.auth.oauth.approveAuthorization(authorizationId)
      : await oauthClient.auth.oauth.denyAuthorization(authorizationId);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirect.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={wideLogo} alt="Widezap" className="h-14 w-auto" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autorizar acesso
          </CardTitle>
          <CardDescription>
            Conceda ou negue acesso da aplicação à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!details && !error && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          )}
          {details && (
            <>
              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium">
                  {details.client?.name ?? "Aplicação externa"}
                </p>
                {details.client?.client_uri && (
                  <p className="text-muted-foreground break-all">
                    {details.client.client_uri}
                  </p>
                )}
                <p className="mt-2 text-muted-foreground">
                  Esta aplicação poderá acessar dados da sua conta usando as ferramentas MCP habilitadas
                  (contatos, deals do CRM e criação de tarefas).
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => decide(false)}
                  disabled={busy}
                >
                  Negar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => decide(true)}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autorizar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
