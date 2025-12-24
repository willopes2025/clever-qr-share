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
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useProfile } from '@/hooks/useProfile';
import { TeamRole } from '@/config/permissions';
import { Shield, User, Loader2, Copy, Check, AlertTriangle, Mail } from 'lucide-react';
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
  const { inviteMember } = useTeamMembers();
  const { profile } = useProfile();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [fallbackInfo, setFallbackInfo] = useState<FallbackInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const appUrl = window.location.origin;
  const roleLabel = role === 'admin' ? 'Administrador' : 'Membro';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await inviteMember.mutateAsync({ 
        email, 
        role,
        inviterName: profile?.full_name || undefined,
      });
      
      if (!result.emailSent) {
        // Email falhou, mostrar fallback
        setFallbackInfo({
          email,
          role,
          organizationName: result.organizationName,
        });
      } else {
        // Email enviado com sucesso, fechar dialog
        handleClose();
      }
    } catch (error) {
      // Erro já tratado pelo onError do mutation
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setFallbackInfo(null);
    setCopied(false);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
          <DialogDescription>
            Envie um convite para adicionar um novo membro à sua equipe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Função</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Membro</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Acesso limitado às funcionalidades básicas (Inbox, Contatos, Funis)
                  </p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Administrador</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Acesso completo a todas as funcionalidades e configurações
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
      </DialogContent>
    </Dialog>
  );
}
