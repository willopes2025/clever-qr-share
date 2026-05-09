import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MetaMessengerCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = search.get('code');
    const errParam = search.get('error') || hash.get('error');

    if (errParam) {
      setStatus('error');
      setError(search.get('error_description') || hash.get('error_description') || errParam);
      return;
    }
    if (!code) {
      setStatus('error');
      setError('Código de autorização não encontrado.');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/meta-social/callback`;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('connect-meta-messenger', {
          body: { user_access_token: token },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Falha ao conectar');
        const count = (data.accounts ?? []).length;
        toast.success(`${count} página(s) conectada(s) com sucesso!`);
        setStatus('success');
        setTimeout(() => navigate('/settings?tab=meta-social', { replace: true }), 1500);
      } catch (e: any) {
        setStatus('error');
        setError(e.message);
        toast.error('Erro ao conectar: ' + e.message);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 p-8 bg-card rounded-xl shadow-lg border border-border text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Conectando suas páginas...</h1>
            <p className="text-muted-foreground">Aguarde, estamos vinculando suas contas Facebook e Instagram.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Conectado!</h1>
            <p className="text-muted-foreground">Redirecionando...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Erro na conexão</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/settings?tab=meta-social', { replace: true })}>
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default MetaMessengerCallback;
