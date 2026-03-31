import { Cloud, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationCardHeaderProps {
  provider: 'evolution' | 'meta' | null;
  label: string;
  phoneNumber?: string | null;
}

export const ConversationCardHeader = ({ provider, label, phoneNumber }: ConversationCardHeaderProps) => {
  const isMeta = provider === 'meta';

  return (
    <div className="flex items-center justify-center my-2">
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shadow-sm border",
        isMeta
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      )}>
        {isMeta ? (
          <Cloud className="h-3 w-3" />
        ) : (
          <Smartphone className="h-3 w-3" />
        )}
        <span>{label}</span>
        {phoneNumber && (
          <>
            <span className="opacity-50">•</span>
            <span className="opacity-70">{phoneNumber}</span>
          </>
        )}
      </div>
    </div>
  );
};
