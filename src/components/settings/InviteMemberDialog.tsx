import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useProfile } from '@/hooks/useProfile';
import { TeamRole } from '@/config/permissions';
import { Shield, User, Loader2, Copy, Check, AlertTriangle, Mail, KeyRound, Send } from 'lucide-react';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FallbackInfo {
  email: string;
  role: TeamRole;
  organizationName: string;
}

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const { inviteMember, createMemberWithPassword } = useTeamMembers();
  const { profile } = useProfile();
  
  // Campos comuns
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  
  // Modo do dialog
  const [mode, setMode] = useState<'invite' | 'create'>('invite');
  
  // Campos para modo "criar com senha"
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Estados de fallback (para convite)
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const appUrl = window.location.origin;

  const getInviteMessage = (info: FallbackInfo) => {
    const roleName = info.role === 'admin' ? 'Administrador' : 'Membro';
    return `Olá! 👋

Você foi convidado para fazer parte da equipe "${info.organizationName}" como ${roleName}.

Para aceitar o convite:
1. Acesse: ${appUrl}/login
2. Crie uma conta usando o email: ${info.email}
3. Após criar a conta, você terá acesso automático à equipe.

Até breve!`;
  };

  const handleCopy = async () => {
    if (!fallbackInfo) return;
    
    try {
      await navigator.clipboard.writeText(getInviteMessage(fallbackInfo));
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar mensagem');
    }
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await inviteMember.mutateAsync({ 
        email, 
        role,
        inviterName: profile?.full_name || undefined,
      });
      
      if (!result.emailSent) {
        setFallbackInfo({
          email,
          role,
          organizationName: result.organizationName,
        });
      } else {
        handleClose();
      }
    } catch (error) {
      // Erro já tratado pelo onError do mutation
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    try {
      await createMemberWithPassword.mutateAsync({ 
        email, 
        password,
        name: name || undefined,
        role,
      });
      handleClose();
    } catch (error) {
      // Erro já tratado pelo onError do mutation
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setFallbackInfo(null);
    setCopied(false);
    setMode('invite');
    onOpenChange(false);
  };

  // Se temos fallback info, mostrar as instruções
  if (fallbackInfo) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Convite Criado - Envio Manual Necessário
            </DialogTitle>
            <DialogDescription>
              O membro foi adicionado à equipe, mas não foi possível enviar o email automaticamente. 
              Copie a mensagem abaixo e envie manualmente para {fallbackInfo.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Mensagem de Convite
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <pre className="text-sm whitespace-pre-wrap text-muted-foreground bg-background rounded p-3 border">
                {getInviteMessage(fallbackInfo)}
              </pre>
            </div>

            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                <strong>Dica:</strong> Você pode enviar essa mensagem por WhatsApp, SMS, ou qualquer outro meio de comunicação.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Membro</DialogTitle>
          <DialogDescription>
            Escolha como deseja adicionar um novo membro à sua equipe.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'invite' | 'create')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite" className="gap-2">
              <Send className="h-4 w-4" />
              Enviar Convite
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Criar com Senha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="mt-4">
            <form onSubmit={handleSubmitInvite} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email-invite">Email</Label>
                <Input
                  id="email-invite"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Um email será enviado para o usuário criar sua própria senha.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Função</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                  <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="member" id="member-invite" />
                    <Label htmlFor="member-invite" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Membro</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acesso limitado às funcionalidades básicas
                      </p>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="admin" id="admin-invite" />
                    <Label htmlFor="admin-invite" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">Administrador</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Acesso completo a todas as funcionalidades
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={inviteMember.isPending}>
                  {inviteMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Convite
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name-create">Nome (opcional)</Label>
                <Input
                  id="name-create"
                  type="text"
                  placeholder="Nome do membro"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-create">Email</Label>
                <Input
                  id="email-create"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Função</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                  <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="member" id="member-create" />
                    <Label htmlFor="member-create" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">Membro</span>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="admin" id="admin-create" />
                    <Label htmlFor="admin-create" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">Administrador</span>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">
                  <strong>Nota:</strong> O membro será criado já ativo e poderá fazer login imediatamente com a senha definida.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMemberWithPassword.isPending}>
                  {createMemberWithPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Membro
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
