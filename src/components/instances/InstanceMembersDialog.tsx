import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, User } from 'lucide-react';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useMemberInstances } from '@/hooks/useMemberInstances';
import { TeamMember } from '@/hooks/useOrganization';

interface InstanceMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
  onSaved?: () => void;
}

export function InstanceMembersDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onSaved,
}: InstanceMembersDialogProps) {
  const { members, isLoading: membersLoading } = useTeamMembers();
  const { assignInstanceToMembers } = useMemberInstances();
  
  const [allMembers, setAllMembers] = useState(true);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Filter only active members
  const activeMembers = members?.filter(m => m.status === 'active') || [];

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAllMembers(true);
      setSelectedMemberIds([]);
    }
  }, [open]);

  const handleAllMembersChange = (checked: boolean) => {
    setAllMembers(checked);
    if (checked) {
      setSelectedMemberIds([]);
    }
  };

  const handleMemberToggle = (memberId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
    // If selecting specific members, uncheck "all members"
    if (allMembers) {
      setAllMembers(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // If "all members" is checked, pass empty array (no restriction)
      // Otherwise, pass the selected member IDs
      await assignInstanceToMembers.mutateAsync({
        instanceId,
        memberIds: allMembers ? [] : selectedMemberIds,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving member access:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getMemberInitials = (member: TeamMember) => {
    const name = member.profile?.full_name || member.email;
    if (!name) return 'M';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Dono';
      case 'admin':
        return 'Admin';
      case 'agent':
        return 'Agente';
      default:
        return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Acesso à Instância
          </DialogTitle>
          <DialogDescription>
            Selecione quais membros da equipe podem ver as conversas da instância <strong>{instanceName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {membersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* All members option */}
            <div
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleAllMembersChange(!allMembers)}
            >
              <Checkbox
                id="all-members"
                checked={allMembers}
                onCheckedChange={handleAllMembersChange}
              />
              <div className="flex items-center gap-2 flex-1">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Todos os membros</p>
                  <p className="text-xs text-muted-foreground">
                    Qualquer membro da equipe pode acessar
                  </p>
                </div>
              </div>
            </div>

            {/* Individual members list */}
            {activeMembers.length > 0 && (
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-2">
                  {activeMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedMemberIds.includes(member.id)
                          ? 'bg-primary/10 border-primary/30'
                          : 'hover:bg-muted/50'
                      } ${allMembers ? 'opacity-50' : ''}`}
                      onClick={() => !allMembers && handleMemberToggle(member.id)}
                    >
                      <Checkbox
                        checked={allMembers || selectedMemberIds.includes(member.id)}
                        disabled={allMembers}
                        onCheckedChange={() => handleMemberToggle(member.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getMemberInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.profile?.full_name || member.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                        {getRoleLabel(member.role)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {activeMembers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum membro ativo na equipe</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Pular
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || (!allMembers && selectedMemberIds.length === 0)}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
