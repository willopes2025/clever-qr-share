import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Facebook, Instagram, Loader2, Trash2, Wifi, WifiOff, Info, Plus } from 'lucide-react';
import { useMetaMessengerAccounts } from '@/hooks/useMetaMessengerAccounts';

const META_APP_ID = '810749588135300';
const SCOPES = [
  'pages_messaging',
  'pages_read_engagement',
  'pages_show_list',
  'pages_manage_metadata',
].join(',');

const buildOAuthUrl = () => {
  const redirectUri = `${window.location.origin}/auth/meta-social/callback`;
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
};

export const MetaSocialSettings = () => {
  const { accounts, isLoading, disconnect } = useMetaMessengerAccounts();

  const handleConnect = () => {
    window.location.href = buildOAuthUrl();
  };

  const messengerAccounts = accounts.filter(a => a.platforms?.includes('messenger'));
  const instagramAccounts = accounts.filter(a => a.platforms?.includes('instagram'));

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-pink-500/20">
                <div className="flex -space-x-2">
                  <Facebook className="h-6 w-6 text-blue-500" />
                  <Instagram className="h-6 w-6 text-pink-500" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl">Facebook & Instagram</CardTitle>
                <CardDescription>
                  Conecte suas Páginas do Facebook e contas Instagram Business para receber e responder mensagens
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={accounts.length > 0 ? 'default' : 'outline'}
              className={accounts.length > 0 ? 'bg-green-500/90 text-white' : ''}
            >
              {accounts.length > 0 ? (
                <><Wifi className="h-3 w-3 mr-1" /> {accounts.length} conectada(s)</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" /> Nenhuma</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Você será redirecionado ao Facebook para autorizar acesso às suas Páginas.
              Para conectar o Instagram, a conta precisa estar vinculada como <strong>Business</strong> a uma Página do Facebook.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleConnect}
            size="lg"
            className="w-full h-12 text-base bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:opacity-90 text-white shadow-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            {accounts.length > 0 ? 'Conectar mais páginas' : 'Conectar com Facebook'}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <>
          <AccountSection
            title="Páginas Facebook (Messenger)"
            icon={<Facebook className="h-5 w-5 text-blue-500" />}
            accounts={messengerAccounts}
            onDisconnect={(id) => disconnect.mutate(id)}
            disconnecting={disconnect.isPending}
            type="messenger"
          />
          <AccountSection
            title="Contas Instagram Business"
            icon={<Instagram className="h-5 w-5 text-pink-500" />}
            accounts={instagramAccounts}
            onDisconnect={(id) => disconnect.mutate(id)}
            disconnecting={disconnect.isPending}
            type="instagram"
          />
        </>
      )}
    </div>
  );
};

const AccountSection = ({
  title,
  icon,
  accounts,
  onDisconnect,
  disconnecting,
  type,
}: {
  title: string;
  icon: React.ReactNode;
  accounts: ReturnType<typeof useMetaMessengerAccounts>['accounts'];
  onDisconnect: (id: string) => void;
  disconnecting: boolean;
  type: 'messenger' | 'instagram';
}) => {
  if (accounts.length === 0) return null;
  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-1">{accounts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map(acc => (
          <div
            key={acc.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              {acc.profile_picture_url ? (
                <img
                  src={acc.profile_picture_url}
                  alt={acc.page_name ?? 'Page'}
                  className="h-10 w-10 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {type === 'instagram' ? `@${acc.ig_username ?? '—'}` : (acc.page_name ?? acc.page_id)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {type === 'messenger'
                    ? (acc.page_category ?? `ID: ${acc.page_id}`)
                    : (acc.page_name ? `via ${acc.page_name}` : `IG: ${acc.ig_business_account_id}`)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {acc.webhook_subscribed && (
                <Badge variant="outline" className="text-green-500 border-green-500/30 hidden sm:inline-flex">
                  Webhook ativo
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDisconnect(acc.id)}
                disabled={disconnecting}
                title="Desconectar"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
