import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Zap, Loader2 } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirecionar se já estiver logado
  if (user) {
    navigate('/instances');
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success('Login realizado com sucesso!');
    navigate('/instances');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success('Conta criada com sucesso! Você já pode fazer login.');
    navigate('/instances');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background animated-gradient cyber-grid p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-neon-magenta/10 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-md glass-card shadow-neon neon-border relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-neon flex items-center justify-center shadow-glow-cyan">
              <Zap className="h-8 w-8 text-background" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-neon opacity-50 blur-sm" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display font-bold text-primary text-glow-cyan">
            WIDEZAP
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Plataforma de disparos WhatsApp com QR Code ilimitado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger value="login" className="font-display data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="font-display data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                Criar Conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-foreground">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-foreground">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-foreground">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-foreground">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary/50 border-border focus:border-primary focus:ring-primary"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
