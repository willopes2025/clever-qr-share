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
import { 
  PERMISSIONS, 
  PermissionKey, 
  PermissionCategory, 
  PERMISSION_CATEGORIES,
  getPermissionsByCategory 
} from '@/config/permissions';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface MemberPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function MemberPermissionsDialog({ open, onOpenChange, member }: MemberPermissionsDialogProps) {
  const { updateMemberPermissions } = useTeamMembers();
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({} as Record<PermissionKey, boolean>);
  const [openCategories, setOpenCategories] = useState<Set<PermissionCategory>>(new Set());

  useEffect(() => {
    if (member) {
      const currentPermissions = {} as Record<PermissionKey, boolean>;
      PERMISSIONS.forEach(p => {
        currentPermissions[p.key] = member.permissions?.[p.key] ?? 
          (member.role === 'admin' ? p.defaultForAdmin : p.defaultForMember);
      });
      setPermissions(currentPermissions);
      
      // Open categories that have enabled permissions for members
      if (member.role !== 'admin') {
        const categoriesWithEnabled = new Set<PermissionCategory>();
        PERMISSIONS.forEach(p => {
          if (currentPermissions[p.key]) {
            categoriesWithEnabled.add(p.category);
          }
        });
        setOpenCategories(categoriesWithEnabled);
      }
    }
  }, [member]);

  const handleToggle = (key: PermissionKey) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCategory = (category: PermissionCategory) => {
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const toggleAllInCategory = (category: PermissionCategory, enabled: boolean) => {
    const categoryPerms = getPermissionsByCategory()[category];
    setPermissions(prev => {
      const updated = { ...prev };
      categoryPerms.forEach(p => {
        updated[p.key] = enabled;
      });
      return updated;
    });
  };

  const getCategoryStats = (category: PermissionCategory) => {
    const categoryPerms = getPermissionsByCategory()[category];
    const enabled = categoryPerms.filter(p => permissions[p.key]).length;
    return { enabled, total: categoryPerms.length };
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

  const permissionsByCategory = getPermissionsByCategory();
  const categoryOrder: PermissionCategory[] = [
    'dashboard', 'instances', 'warming', 'inbox', 'funnels', 'calendar',
    'analysis', 'contacts', 'leads', 'lists', 'templates', 
    'campaigns', 'chatbots', 'forms', 'ai_agents', 'finances', 'ssotica',
    'settings', 'team', 'notifications'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Permissões de {member.profile?.full_name || member.email}</DialogTitle>
          <DialogDescription>
            Personalize as permissões deste membro da equipe por categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2 pr-2">
          {categoryOrder.map((category) => {
            const categoryPerms = permissionsByCategory[category];
            if (!categoryPerms || categoryPerms.length === 0) return null;
            
            const stats = getCategoryStats(category);
            const isOpen = openCategories.has(category);
            const allEnabled = stats.enabled === stats.total;
            const someEnabled = stats.enabled > 0 && stats.enabled < stats.total;

            return (
              <Collapsible 
                key={category} 
                open={isOpen}
                onOpenChange={() => toggleCategory(category)}
              >
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted cursor-pointer">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">
                          {PERMISSION_CATEGORIES[category]}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          allEnabled ? "bg-primary/20 text-primary" :
                          someEnabled ? "bg-amber-500/20 text-amber-600" :
                          "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                          {stats.enabled}/{stats.total}
                        </span>
                      </div>
                      <div 
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleAllInCategory(category, !allEnabled)}
                        >
                          {allEnabled ? 'Desmarcar todos' : 'Marcar todos'}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="p-3 space-y-3 border-t">
                      {categoryPerms.map((permission) => (
                        <div key={permission.key} className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={permission.key} className="font-normal text-sm cursor-pointer">
                              {permission.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">
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
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
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
