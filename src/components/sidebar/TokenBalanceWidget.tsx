import { useNavigate } from "react-router-dom";
import { Coins, AlertTriangle, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAITokens } from "@/hooks/useAITokens";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface TokenBalanceWidgetProps {
  isCollapsed: boolean;
}

export const TokenBalanceWidget = ({ isCollapsed }: TokenBalanceWidgetProps) => {
  const navigate = useNavigate();
  const { balance, loadingBalance, formatTokens } = useAITokens();
  
  const currentBalance = balance?.balance || 0;
  const totalPurchased = balance?.totalPurchased || 0;
  
  // Calculate percentage based on total purchased (if no purchases, show 0%)
  const percentage = totalPurchased > 0 
    ? Math.min((currentBalance / totalPurchased) * 100, 100) 
    : (currentBalance > 0 ? 100 : 0);

  // Determine status level
  const getStatusLevel = () => {
    if (currentBalance === 0) return 'critical';
    if (percentage <= 20) return 'low';
    if (percentage <= 50) return 'medium';
    return 'good';
  };

  const statusLevel = getStatusLevel();

  // Get colors and effects based on status
  const getStatusStyles = () => {
    switch (statusLevel) {
      case 'critical':
        return {
          bgColor: 'bg-destructive/20',
          textColor: 'text-destructive',
          progressColor: 'bg-destructive',
          iconColor: 'text-destructive',
          animation: 'animate-shake',
          pulseAnimation: 'animate-pulse',
        };
      case 'low':
        return {
          bgColor: 'bg-destructive/10',
          textColor: 'text-destructive',
          progressColor: 'bg-destructive',
          iconColor: 'text-destructive',
          animation: '',
          pulseAnimation: 'animate-pulse',
        };
      case 'medium':
        return {
          bgColor: 'bg-yellow-500/10',
          textColor: 'text-yellow-600 dark:text-yellow-400',
          progressColor: 'bg-yellow-500',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          animation: '',
          pulseAnimation: '',
        };
      default:
        return {
          bgColor: 'bg-accent/10',
          textColor: 'text-accent',
          progressColor: 'bg-accent',
          iconColor: 'text-accent',
          animation: '',
          pulseAnimation: '',
        };
    }
  };

  const styles = getStatusStyles();

  const handleBuyTokens = () => {
    navigate('/settings?tab=ai-tokens');
  };

  if (loadingBalance) {
    if (isCollapsed) {
      return (
        <div className="flex justify-center">
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      );
    }
    return (
      <div className="rounded-xl p-4 bg-sidebar-accent/30 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  // Collapsed version
  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            onClick={handleBuyTokens}
            className={cn(
              "relative flex items-center justify-center p-3 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105",
              styles.bgColor,
              styles.animation
            )}
          >
            <Coins className={cn("h-5 w-5", styles.iconColor, styles.pulseAnimation)} />
            {statusLevel === 'critical' && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-ping" />
            )}
            {(statusLevel === 'low' || statusLevel === 'critical') && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="space-y-1">
          <p className="text-xs text-muted-foreground">Tokens IA</p>
          <p className={cn("text-sm font-semibold", styles.textColor)}>
            {formatTokens(currentBalance)}
          </p>
          {statusLevel === 'critical' && (
            <p className="text-xs text-destructive">Sem tokens! Clique para comprar</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded version
  return (
    <div 
      className={cn(
        "rounded-xl p-4 transition-all duration-300",
        styles.bgColor,
        styles.animation
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Coins className={cn("h-4 w-4", styles.iconColor, styles.pulseAnimation)} />
          <span className="text-xs text-sidebar-foreground/60">Tokens IA</span>
        </div>
        {(statusLevel === 'low' || statusLevel === 'critical') && (
          <AlertTriangle className={cn("h-4 w-4", styles.iconColor, styles.pulseAnimation)} />
        )}
      </div>
      
      <div className="flex items-baseline gap-1 mb-2">
        <span className={cn("text-lg font-bold", styles.textColor)}>
          {formatTokens(currentBalance)}
        </span>
        {totalPurchased > 0 && (
          <span className="text-xs text-sidebar-foreground/50">
            / {formatTokens(totalPurchased)}
          </span>
        )}
      </div>

      <div className="relative h-1.5 bg-sidebar-accent/30 rounded-full overflow-hidden mb-3">
        <div 
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-500",
            styles.progressColor,
            styles.pulseAnimation
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {statusLevel === 'critical' ? (
        <Button 
          onClick={handleBuyTokens}
          size="sm"
          className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Adquirir Tokens
        </Button>
      ) : statusLevel === 'low' ? (
        <Button 
          onClick={handleBuyTokens}
          size="sm"
          variant="outline"
          className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive/10 rounded-lg"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Comprar Mais
        </Button>
      ) : (
        <button
          onClick={handleBuyTokens}
          className="text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full text-center"
        >
          Gerenciar tokens →
        </button>
      )}
    </div>
  );
};
