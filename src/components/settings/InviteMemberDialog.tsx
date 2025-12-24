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
import { Shield, User, Loader2 } from 'lucide-react';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const { inviteMember } = useTeamMembers();
  const { profile } = useProfile();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await inviteMember.mutateAsync({ 
      email, 
      role,
      inviterName: profile?.full_name || undefined,
    });
    
    setEmail('');
    setRole('member');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
