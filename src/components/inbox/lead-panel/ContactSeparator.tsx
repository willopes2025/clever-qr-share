import { User } from "lucide-react";

interface ContactSeparatorProps {
  contactName?: string | null;
}

export const ContactSeparator = ({ contactName }: ContactSeparatorProps) => {
  return (
    <div className="relative px-4 py-3">
      <div className="absolute inset-0 flex items-center px-4">
        <div className="w-full border-t border-border/60" />
      </div>
      <div className="relative flex justify-center">
        <div className="flex items-center gap-2 bg-card px-4 py-1.5 rounded-full border border-border/60 shadow-sm">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {contactName || 'Contato'}
          </span>
        </div>
      </div>
    </div>
  );
};
