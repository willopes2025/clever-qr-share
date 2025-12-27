import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User, Check, Users } from "lucide-react";
import { useState } from "react";

interface AssigneeSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  compact?: boolean;
}

export function AssigneeSelector({ value, onChange, compact = false }: AssigneeSelectorProps) {
  const { user } = useAuth();
  const { members } = useTeamMembers();
  const [open, setOpen] = useState(false);

  // Combinar usuário atual com membros da equipe
  const allMembers = [
    {
      id: user?.id || '',
      name: 'Eu',
      email: user?.email || '',
      avatar_url: null,
      isCurrentUser: true,
    },
    ...members
      .filter(m => m.user_id && m.user_id !== user?.id && m.status === 'active')
      .map(m => ({
        id: m.user_id!,
        name: m.email.split('@')[0],
        email: m.email,
        avatar_url: null,
        isCurrentUser: false,
      })),
  ];

  const selectedMember = allMembers.find(m => m.id === value);

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 border-dashed",
              selectedMember && "border-solid"
            )}
          >
            {selectedMember ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedMember.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(selectedMember.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline max-w-24 truncate">{selectedMember.name}</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Atribuir</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <div className="grid gap-0.5">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                !value && "bg-muted"
              )}
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Não atribuído</span>
              {!value && <Check className="h-4 w-4 ml-auto" />}
            </button>
            {allMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onChange(member.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                  value === member.id && "bg-muted"
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {member.name}
                  {member.isCurrentUser && <span className="text-muted-foreground ml-1">(você)</span>}
                </span>
                {value === member.id && <Check className="h-4 w-4 ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allMembers.map((member) => (
        <Button
          key={member.id}
          variant={value === member.id ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onChange(value === member.id ? null : member.id)}
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <span>{member.name}</span>
        </Button>
      ))}
    </div>
  );
}
