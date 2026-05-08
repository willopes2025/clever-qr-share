import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeamGroups } from '@/hooks/useTeamGroups';
import { Loader2 } from 'lucide-react';

interface Props {
  memberId: string;
  currentGroupId: string | null | undefined;
  disabled?: boolean;
}

const NONE_VALUE = '__none__';

export function MemberTeamGroupSelector({ memberId, currentGroupId, disabled }: Props) {
  const { groups, isLoading, applyToMember } = useTeamGroups();

  const handleChange = (value: string) => {
    const groupId = value === NONE_VALUE ? null : value;
    if (groupId === (currentGroupId ?? null)) return;
    applyToMember.mutate({ memberId, groupId });
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Select
      value={currentGroupId ?? NONE_VALUE}
      onValueChange={handleChange}
      disabled={disabled || applyToMember.isPending}
    >
      <SelectTrigger className="h-8 w-[160px]">
        <SelectValue placeholder="Sem equipe" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>Sem equipe</SelectItem>
        {groups.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
