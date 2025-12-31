import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactIdBadgeProps {
  displayId: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export const ContactIdBadge = ({ displayId, size = "md", className }: ContactIdBadgeProps) => {
  const [copied, setCopied] = useState(false);

  if (!displayId) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayId);
      setCopied(true);
      toast.success("ID copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const isSmall = size === "sm";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Badge 
        variant="outline" 
        className={cn(
          "font-mono bg-muted/50",
          isSmall ? "text-[9px] h-4 px-1.5" : "text-xs h-5 px-2"
        )}
      >
        #{displayId}
      </Badge>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 hover:bg-muted",
              isSmall ? "h-4 w-4" : "h-5 w-5"
            )}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className={cn("text-primary", isSmall ? "h-2.5 w-2.5" : "h-3 w-3")} />
            ) : (
              <Copy className={cn("text-muted-foreground", isSmall ? "h-2.5 w-2.5" : "h-3 w-3")} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copiar ID</TooltipContent>
      </Tooltip>
    </div>
  );
};