import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CallbackStatus = 'processing' | 'success' | 'error';

const MetaAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const hasProcessed = useRef(false);

  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    // Prevent double processing
    if (hasProcessed.current) return;

    if (errorParam) {
      hasProcessed.current = true;
      setStatus('error');
      setErrorMessage(errorDescription || `Erro de autorização: ${errorParam}`);
      toast.error('Autorização do Facebook cancelada');
      return;
    }

    if (!code) {
      hasProcessed.current = true;
      setStatus('error');
      setErrorMessage('Código de autorização não encontrado na URL');
      return;
    }

    hasProcessed.current = true;
    exchangeCodeForToken(code);
  }, [code, errorParam, errorDescription]);

  const exchangeCodeForToken = async (authCode: string) => {
    setStatus('processing');
    
    try {
      // Set a timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
        body: { code: authCode }
      });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(error.message || 'Erro ao processar autenticação');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao conectar com WhatsApp Business');
      }

      setStatus('success');
      toast.success('WhatsApp Business conectado com sucesso!');

      // Redirect after success
      setTimeout(() => {
        navigate('/settings', { replace: true });
      }, 2000);

    } catch (err: any) {
      console.error('[MetaAuthCallback] Error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro desconhecido ao processar autenticação');
      toast.error('Erro ao conectar WhatsApp Business');
    }
  };

  const handleRetry = () => {
    hasProcessed.current = false;
    if (code) {
      exchangeCodeForToken(code);
    } else {
      navigate('/settings');
    }
  };

  const handleGoBack = () => {
    navigate('/settings', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 p-8 bg-card rounded-xl shadow-lg border border-border text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Processando autenticação...
            </h1>
            <p className="text-muted-foreground">
              Aguarde enquanto conectamos sua conta do WhatsApp Business.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Conectado com sucesso!
            </h1>
            <p className="text-muted-foreground mb-4">
              Sua conta do WhatsApp Business foi conectada. Redirecionando...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Erro na autenticação
            </h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleGoBack}>
                Voltar para Configurações
              </Button>
              {code && (
                <Button onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MetaAuthCallback;
