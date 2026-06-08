import { Cloud, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationCardHeaderProps {
  provider: 'evolution' | 'meta' | null;
  label: string;
  phoneNumber?: string | null;
  originKey?: string;
}

// Static Tailwind class map (avoids purge issues with dynamic class names)
const COLOR_PALETTE = [
  { line: "border-emerald-500/30", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  { line: "border-blue-500/30", bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  { line: "border-violet-500/30", bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-600 dark:text-violet-400" },
  { line: "border-amber-500/30", bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
  { line: "border-rose-500/30", bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-600 dark:text-rose-400" },
  { line: "border-cyan-500/30", bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400" },
  { line: "border-fuchsia-500/30", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  { line: "border-lime-500/30", bg: "bg-lime-500/10", border: "border-lime-500/20", text: "text-lime-600 dark:text-lime-400" },
  { line: "border-orange-500/30", bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
  { line: "border-teal-500/30", bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-600 dark:text-teal-400" },
];

const getOriginColor = (key: string | undefined, provider: 'evolution' | 'meta' | null) => {
  if (!key) {
    return provider === 'meta' ? COLOR_PALETTE[1] : COLOR_PALETTE[0];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
};

export const ConversationCardHeader = ({ provider, label, phoneNumber, originKey }: ConversationCardHeaderProps) => {
  const isMeta = provider === 'meta';
  const color = getOriginColor(originKey, provider);

  return (
    <div className="relative px-4 py-3 animate-fade-in">
      <div className="absolute inset-0 flex items-center px-4">
        <div className={cn("w-full border-t transition-colors", color.line)} />
      </div>
      <div className="relative flex justify-center">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shadow-sm border backdrop-blur-sm",
            color.bg,
            color.border,
            color.text,
          )}
        >
          {isMeta ? <Cloud className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
          <span>{label}</span>
          {phoneNumber && (
            <>
              <span className="opacity-50">•</span>
              <span className="opacity-70">{phoneNumber}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
