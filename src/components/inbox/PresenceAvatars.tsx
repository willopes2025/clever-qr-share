import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/useConversationPresence";

interface PresenceAvatarsProps {
  users: PresenceUser[];
  max?: number;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const PresenceAvatars = ({ users, max = 3 }: PresenceAvatarsProps) => {
  if (!users.length) return null;
  const visible = users.slice(0, max);
  const extra = users.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <Tooltip key={u.user_id}>
          <TooltipTrigger asChild>
            <span className="relative inline-block">
              <Avatar className="h-7 w-7 ring-2 ring-card">
                {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.full_name} /> : null}
                <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                  {initials(u.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {u.full_name} está vendo este lead
          </TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && (
        <span className="h-7 min-w-7 px-1.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium flex items-center justify-center ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
};
