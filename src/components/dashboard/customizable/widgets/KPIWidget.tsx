import { useState } from "react";
import { MoreVertical, X, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getWidgetIcon } from "../WidgetIcons";
import { cn } from "@/lib/utils";

interface KPIWidgetProps {
  widgetKey: string;
  name: string;
  description: string | null;
  icon: string | null;
  size: 'small' | 'medium' | 'large';
  sizeOptions: string[];
  data: {
    value: string | number;
    trend?: number;
    trendLabel?: string;
    subValue?: string;
    chartData?: any[];
  };
  loading: boolean;
  onRemove: () => void;
  onResize: (size: 'small' | 'medium' | 'large') => void;
}

export const KPIWidget = ({
  widgetKey,
  name,
  description,
  icon,
  size,
  sizeOptions,
  data,
  loading,
  onRemove,
  onResize
}: KPIWidgetProps) => {
  const IconComponent = getWidgetIcon(icon);

  const getTrendColor = (trend?: number) => {
    if (!trend) return 'text-muted-foreground';
    if (trend > 0) return 'text-emerald-600';
    if (trend < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const formatTrend = (trend?: number) => {
    if (!trend) return null;
    const sign = trend > 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  };

  return (
    <Card className="relative group h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <IconComponent className="h-4 w-4" />
          <span className="truncate">{name}</span>
        </CardTitle>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sizeOptions.includes('small') && size !== 'small' && (
              <DropdownMenuItem onClick={() => onResize('small')}>
                <Minimize2 className="h-4 w-4 mr-2" />
                Pequeno
              </DropdownMenuItem>
            )}
            {sizeOptions.includes('medium') && size !== 'medium' && (
              <DropdownMenuItem onClick={() => onResize('medium')}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Médio
              </DropdownMenuItem>
            )}
            {sizeOptions.includes('large') && size !== 'large' && (
              <DropdownMenuItem onClick={() => onResize('large')}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Grande
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onRemove}
              className="text-red-600 focus:text-red-600"
            >
              <X className="h-4 w-4 mr-2" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {data.value}
              </span>
              {data.trend !== undefined && (
                <span className={cn("text-sm font-medium", getTrendColor(data.trend))}>
                  {formatTrend(data.trend)}
                </span>
              )}
            </div>
            
            {data.subValue && (
              <p className="text-xs text-muted-foreground">
                {data.subValue}
              </p>
            )}

            {data.trendLabel && (
              <p className="text-xs text-muted-foreground">
                {data.trendLabel}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
