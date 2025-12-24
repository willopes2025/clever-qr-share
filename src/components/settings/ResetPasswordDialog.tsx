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
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { TeamMember } from '@/hooks/useOrganization';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
  onReset: (newPassword: string) => Promise<void>;
  isLoading?: boolean;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
  onReset,
  isLoading,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isValid = password.length >= 6 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    
    await onReset(password);
    setPassword('');
    setConfirmPassword('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {member.profile?.full_name || member.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !isValid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir Senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
