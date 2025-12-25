import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/hooks/useOrganization';
import { PERMISSIONS, PERMISSION_CATEGORIES, PermissionCategory, hasPermission, TeamRole } from '@/config/permissions';
import { Check, X, Shield, User, Crown, Building2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function MyPermissionsCard() {
  const { organization, currentMember, isOwner, isLoading } = useOrganization();
  const [ownerName, setOwnerName] = useState<string | null>(null);

  useEffect(() => {
    const fetchOwnerName = async () => {
      if (!organization?.owner_id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', organization.owner_id)
        .single();
      
      setOwnerName(data?.full_name || 'Administrador');
    };

    fetchOwnerName();
  }, [organization?.owner_id]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Só mostrar para membros de equipe (não owners)
  if (!organization || !currentMember || isOwner) {
    return null;
  }

  const role = currentMember.role as TeamRole;
  const permissions = currentMember.permissions as Record<string, boolean> | null;

  // Agrupar permissões por categoria
  const permissionsByCategory = PERMISSIONS.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push({
      ...permission,
      granted: hasPermission(permissions, permission.key, role),
    });
    return acc;
  }, {} as Record<PermissionCategory, Array<typeof PERMISSIONS[0] & { granted: boolean }>>);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Minhas Permissões
            </CardTitle>
            <CardDescription>
              Suas permissões na organização "{organization.name}"
            </CardDescription>
          </div>
          <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="h-7">
            {role === 'admin' ? (
              <><Shield className="mr-1 h-3 w-3" /> Admin</>
            ) : (
              <><User className="mr-1 h-3 w-3" /> Membro</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info do Owner */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Proprietário da organização</p>
            <p className="font-medium">{ownerName}</p>
          </div>
        </div>

        {/* Permissões por categoria */}
        <div className="grid gap-4">
          {(Object.entries(permissionsByCategory) as [PermissionCategory, typeof permissionsByCategory[PermissionCategory]][]).map(([category, perms]) => {
            const grantedCount = perms.filter(p => p.granted).length;
            const allGranted = grantedCount === perms.length;
            const noneGranted = grantedCount === 0;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {PERMISSION_CATEGORIES[category]}
                  </h4>
                  <Badge 
                    variant="outline" 
                    className={
                      allGranted ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
                      noneGranted ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                    }
                  >
                    {grantedCount}/{perms.length}
                  </Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-1">
                  {perms.map((perm) => (
                    <div 
                      key={perm.key}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        perm.granted 
                          ? 'text-foreground' 
                          : 'text-muted-foreground opacity-60'
                      }`}
                    >
                      {perm.granted ? (
                        <Check className="h-4 w-4 text-neon-green shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="truncate" title={perm.description}>
                        {perm.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
          Suas permissões são definidas pelo administrador da organização
        </p>
      </CardContent>
    </Card>
  );
}
