import { Badge } from "@/components/ui/badge";
import { Smartphone, Cloud } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProviderBadgeProps {
  provider: 'evolution' | 'meta' | null | undefined;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export const ProviderBadge = ({ provider, size = 'sm', showLabel = false }: ProviderBadgeProps) => {
  const isMeta = provider === 'meta';
  
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';
  const badgeSize = size === 'sm' ? 'h-4 px-1' : 'h-5 px-1.5';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={isMeta ? 'default' : 'secondary'}
          className={cn(
            badgeSize,
            textSize,
            "gap-0.5 font-medium",
            isMeta 
              ? "bg-blue-500/90 hover:bg-blue-500 text-white" 
              : "bg-emerald-500/90 hover:bg-emerald-500 text-white"
          )}
        >
          {isMeta ? (
            <Cloud className={iconSize} />
          ) : (
            <Smartphone className={iconSize} />
          )}
          {showLabel && (
            <span className="ml-0.5">
              {isMeta ? 'API' : 'Lite'}
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isMeta ? 'WhatsApp Business API (Meta)' : 'WhatsApp Lite (Evolution)'}
      </TooltipContent>
    </Tooltip>
  );
};
