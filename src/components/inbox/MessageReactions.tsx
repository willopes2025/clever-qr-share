import { useState } from "react";
import { Smile } from "lucide-react";
import { MessageReaction } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageReactionsDisplayProps {
  reactions: MessageReaction[];
  isOutbound: boolean;
}

export const MessageReactionsDisplay = ({ reactions, isOutbound }: MessageReactionsDisplayProps) => {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const grouped: Record<string, number> = {};
  for (const r of reactions) {
    grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
  }

  return (
    <div className={cn(
      "flex gap-0.5 -mt-1.5 relative z-10",
      isOutbound ? "justify-end pr-2" : "justify-start pl-2"
    )}>
      {Object.entries(grouped).map(([emoji, count]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-0.5 bg-background border border-border rounded-full px-1.5 py-0.5 text-xs shadow-sm"
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-[10px] text-muted-foreground">{count}</span>}
        </span>
      ))}
    </div>
  );
};

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  isOutbound: boolean;
}

export const ReactionPicker = ({ onReact, isOutbound }: ReactionPickerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20",
        isOutbound ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full mr-1"
      )}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="h-7 w-7 flex items-center justify-center rounded-full bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
      >
        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {isVisible && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-background border border-border rounded-full px-1.5 py-1 shadow-lg",
          isOutbound ? "right-full mr-1" : "left-full ml-1"
        )}>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setIsVisible(false);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-accent transition-colors text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
