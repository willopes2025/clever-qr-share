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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { TeamMember } from '@/hooks/useOrganization';
import { PERMISSIONS, PermissionKey } from '@/config/permissions';
import { Loader2 } from 'lucide-react';

interface MemberPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberPermissionsDialog({ open, onOpenChange, member }: MemberPermissionsDialogProps) {
  const { updateMemberPermissions } = useTeamMembers();
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({} as Record<PermissionKey, boolean>);

  useEffect(() => {
    if (member) {
      const currentPermissions = {} as Record<PermissionKey, boolean>;
      PERMISSIONS.forEach(p => {
        currentPermissions[p.key] = member.permissions?.[p.key] ?? 
          (member.role === 'admin' ? p.defaultForAdmin : p.defaultForMember);
      });
      setPermissions(currentPermissions);
    }
  }, [member]);

  const handleToggle = (key: PermissionKey) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    await updateMemberPermissions.mutateAsync({
      memberId: member.id,
      permissions,
    });
    onOpenChange(false);
  };

  if (member.role === 'admin') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissões de {member.profile?.full_name || member.email}</DialogTitle>
            <DialogDescription>
              Administradores têm acesso completo a todas as funcionalidades.
              Para restringir permissões, rebaixe este membro para "Membro" primeiro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões de {member.profile?.full_name || member.email}</DialogTitle>
          <DialogDescription>
            Personalize as permissões deste membro da equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
          {PERMISSIONS.map((permission) => (
            <div key={permission.key} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor={permission.key} className="font-medium">
                  {permission.label}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {permission.description}
                </p>
              </div>
              <Switch
                id={permission.key}
                checked={permissions[permission.key]}
                onCheckedChange={() => handleToggle(permission.key)}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMemberPermissions.isPending}>
            {updateMemberPermissions.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
