import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { TeamMember } from '@/hooks/useOrganization';
import { TeamRole } from '@/config/permissions';
import { formatPhoneNumber } from '@/lib/phone-utils';

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onSave: (data: { name?: string; email?: string; role: TeamRole; phone?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
  onSave,
  isLoading,
}: EditMemberDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<TeamRole>('member');

  useEffect(() => {
    if (open && member) {
      setName(member.profile?.full_name || '');
      setEmail(member.email);
      setPhone((member as any).phone || '');
      setRole(member.role);
    }
  }, [open, member]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSave({
      name: name.trim() || undefined,
      email: member.status === 'invited' ? email.trim() : undefined,
      phone: phone.trim() || undefined,
      role,
    });
    onOpenChange(false);
  };

  const canEditEmail = member.status === 'invited';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
            <DialogDescription>
              Altere as informações do membro da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {member.user_id && (
              <div className="space-y-2">
                <Label htmlFor="member-name">Nome</Label>
                <Input
                  id="member-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do membro"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={!canEditEmail}
              />
              {!canEditEmail && (
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado após o membro aceitar o convite.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-phone">Telefone (WhatsApp)</Label>
              <Input
                id="member-phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Telefone para receber notificações via WhatsApp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-role">Função</Label>
              <Select value={role} onValueChange={(value: TeamRole) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
