import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import wideLogo from "@/assets/wide-logo.png";

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const setInvalidLink = () => {
      if (!mounted) return;
      setCheckingLink(false);
      setRecoveryReady(false);
      toast.error('Link de recuperação inválido ou expirado');
      navigate('/login', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setRecoveryReady(true);
        setCheckingLink(false);
      }
    });

    const initializeRecovery = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      const hasRecoveryParams =
        searchParams.has('code') ||
        hashParams.has('access_token') ||
        hashParams.get('type') === 'recovery';

      if (!hasRecoveryParams) {
        setInvalidLink();
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setInvalidLink();
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        setRecoveryReady(true);
        setCheckingLink(false);
        return;
      }

      // Retry up to 3 times with ~1s gap (mobile/Safari can take >800ms to hydrate)
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        if (!mounted) return;

        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (retrySession) {
          setRecoveryReady(true);
          setCheckingLink(false);
          return;
        }
      }

      setInvalidLink();
    };

    initializeRecovery();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryReady) {
      toast.error('Aguarde a validação do link de recuperação');
      return;
    }

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast.error('Erro ao redefinir senha: ' + error.message);
      return;
    }

    setSuccess(true);
    toast.success('Senha redefinida com sucesso!');
    
    // Sign out and redirect after a delay
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login');
    }, 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Senha Redefinida!</h2>
              <p className="text-center text-sm text-muted-foreground">
                Sua senha foi alterada com sucesso. Você será redirecionado para a tela de login.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Validando link</h2>
                <p className="text-sm text-muted-foreground">
                  Estamos preparando a redefinição da sua senha.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Link 
        to="/login" 
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors z-20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao Login</span>
      </Link>

      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={wideLogo} alt="Widezap" className="h-16 w-auto" />
          </div>
          <CardTitle>Redefinir Senha</CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-card border-border focus:border-primary focus:ring-primary rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-card border-border focus:border-primary focus:ring-primary rounded-xl"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-medium text-white font-semibold transition-all duration-300 rounded-xl" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
