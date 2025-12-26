import { useState, useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MoreHorizontal, UserPlus, Shield, User, Trash2, Settings2, Crown, Building2, 
  RefreshCw, Pencil, Key 
} from 'lucide-react';
import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberPermissionsDialog } from './MemberPermissionsDialog';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
import { EditOrganizationDialog } from './EditOrganizationDialog';
import { DeleteOrganizationDialog } from './DeleteOrganizationDialog';
import { EditMemberDialog } from './EditMemberDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { MyPermissionsCard } from './MyPermissionsCard';
import { TeamMember } from '@/hooks/useOrganization';
import { TeamRole } from '@/config/permissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TeamSettings() {
  const { 
    organization, 
    isOwner, 
    isAdmin, 
    isLoading: isLoadingOrg,
    updateOrganization,
    deleteOrganization 
  } = useOrganization();
  const { 
    members, 
    isLoading: isLoadingMembers, 
    updateMemberRole, 
    updateMember,
    removeMember, 
    resendInvite,
    resetPassword 
  } = useTeamMembers();
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [editOrgDialogOpen, setEditOrgDialogOpen] = useState(false);
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Sincroniza o selectedMember com os dados atualizados do members
  useEffect(() => {
    if (selectedMember && members.length > 0) {
      const updatedMember = members.find(m => m.id === selectedMember.id);
      if (updatedMember && JSON.stringify(updatedMember) !== JSON.stringify(selectedMember)) {
        setSelectedMember(updatedMember);
      }
    }
  }, [members, selectedMember]);

  const handleOpenPermissions = (member: TeamMember) => {
    setSelectedMember(member);
    setPermissionsDialogOpen(true);
  };

  const handleOpenEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setEditMemberDialogOpen(true);
  };

  const handleOpenResetPassword = (member: TeamMember) => {
    setSelectedMember(member);
    setResetPasswordDialogOpen(true);
  };

  const handleRemoveMember = async () => {
    if (memberToRemove) {
      await removeMember.mutateAsync(memberToRemove.id);
      setMemberToRemove(null);
    }
  };

  const handleToggleRole = async (member: TeamMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    await updateMemberRole.mutateAsync({ memberId: member.id, role: newRole });
  };

  const handleResendInvite = async (member: TeamMember) => {
    await resendInvite.mutateAsync({
      email: member.email,
      role: member.role,
    });
  };

  const handleSaveOrganization = async (name: string) => {
    await updateOrganization.mutateAsync(name);
  };

  const handleDeleteOrganization = async () => {
    await deleteOrganization.mutateAsync();
  };

  const handleSaveMember = async (data: { name?: string; email?: string; role: TeamRole }) => {
    if (selectedMember) {
      await updateMember.mutateAsync({ memberId: selectedMember.id, data });
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (selectedMember?.user_id) {
      await resetPassword.mutateAsync({ userId: selectedMember.user_id, newPassword });
    }
  };

  if (isLoadingOrg) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Criar Organização
          </CardTitle>
          <CardDescription>
            Crie uma organização para começar a gerenciar sua equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setCreateOrgDialogOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" />
            Criar Organização
          </Button>
        </CardContent>
        
        <CreateOrganizationDialog 
          open={createOrgDialogOpen} 
          onOpenChange={setCreateOrgDialogOpen} 
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de permissões do membro atual */}
      <MyPermissionsCard />

      {/* Cabeçalho da Organização */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {organization.name}
              </CardTitle>
              <CardDescription>
                Gerencie os membros da sua equipe e suas permissões
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setEditOrgDialogOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteOrgDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {isAdmin && (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convidar Membro
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            {members.length} membro{members.length !== 1 ? 's' : ''} na equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrou em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {(member.profile?.full_name || member.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.profile?.full_name || member.email.split('@')[0]}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        {member.user_id === organization.owner_id && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                        {member.role === 'admin' ? (
                          <><Shield className="mr-1 h-3 w-3" /> Admin</>
                        ) : (
                          <><User className="mr-1 h-3 w-3" /> Membro</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        member.status === 'active' ? 'default' :
                        member.status === 'invited' ? 'outline' : 'destructive'
                      }>
                        {member.status === 'active' ? 'Ativo' :
                         member.status === 'invited' ? 'Pendente' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.joined_at 
                        ? format(new Date(member.joined_at), "dd 'de' MMM, yyyy", { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {isAdmin && member.user_id !== organization.owner_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.status === 'invited' && (
                              <>
                                <DropdownMenuItem onClick={() => handleResendInvite(member)}>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Reenviar Convite
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleOpenEditMember(member)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleRole(member)}>
                              {member.role === 'admin' ? (
                                <><User className="mr-2 h-4 w-4" /> Rebaixar para Membro</>
                              ) : (
                                <><Shield className="mr-2 h-4 w-4" /> Promover a Admin</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenPermissions(member)}>
                              <Settings2 className="mr-2 h-4 w-4" />
                              Permissões
                            </DropdownMenuItem>
                            {member.status === 'active' && member.user_id && (
                              <DropdownMenuItem onClick={() => handleOpenResetPassword(member)}>
                                <Key className="mr-2 h-4 w-4" />
                                Redefinir Senha
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InviteMemberDialog 
        open={inviteDialogOpen} 
        onOpenChange={setInviteDialogOpen} 
      />

      {selectedMember && (
        <>
          <MemberPermissionsDialog
            open={permissionsDialogOpen}
            onOpenChange={setPermissionsDialogOpen}
            member={selectedMember}
          />
          <EditMemberDialog
            open={editMemberDialogOpen}
            onOpenChange={setEditMemberDialogOpen}
            member={selectedMember}
            onSave={handleSaveMember}
            isLoading={updateMember.isPending}
          />
          {selectedMember.user_id && (
            <ResetPasswordDialog
              open={resetPasswordDialogOpen}
              onOpenChange={setResetPasswordDialogOpen}
              member={selectedMember}
              onReset={handleResetPassword}
              isLoading={resetPassword.isPending}
            />
          )}
        </>
      )}

      {organization && (
        <>
          <EditOrganizationDialog
            open={editOrgDialogOpen}
            onOpenChange={setEditOrgDialogOpen}
            organization={organization}
            onSave={handleSaveOrganization}
            isLoading={updateOrganization.isPending}
          />
          <DeleteOrganizationDialog
            open={deleteOrgDialogOpen}
            onOpenChange={setDeleteOrgDialogOpen}
            organization={organization}
            onDelete={handleDeleteOrganization}
            isLoading={deleteOrganization.isPending}
          />
        </>
      )}

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {memberToRemove?.profile?.full_name || memberToRemove?.email} da equipe?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
