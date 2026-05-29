import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PresenceUser } from "@/hooks/useConversationPresence";

interface UserTypingIndicatorProps {
  users: PresenceUser[];
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const UserTypingIndicator = ({ users }: UserTypingIndicatorProps) => {
  if (!users.length) return null;

  const label =
    users.length === 1
      ? `${firstName(users[0].full_name)} está digitando...`
      : users.length === 2
      ? `${firstName(users[0].full_name)} e ${firstName(users[1].full_name)} estão digitando...`
      : `${firstName(users[0].full_name)} e mais ${users.length - 1} estão digitando...`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground"
    >
      <div className="flex -space-x-1.5">
        {users.slice(0, 3).map((u) => (
          <Avatar key={u.user_id} className="h-5 w-5 ring-2 ring-background">
            {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.full_name} /> : null}
            <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
              {initials(u.full_name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="font-medium text-foreground/80">{label}</span>
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-primary"
            animate={{ y: [0, -2, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    </motion.div>
  );
};
