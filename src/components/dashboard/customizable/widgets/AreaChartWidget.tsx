import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useChartWidgetData, DateRange } from "@/hooks/useChartWidgetData";
import { Skeleton } from "@/components/ui/skeleton";

interface AreaChartWidgetProps {
  widgetKey: string;
  name: string;
  description?: string;
  size: 'small' | 'medium' | 'large';
  sizeOptions?: string[];
  dateRange: DateRange;
  onRemove: () => void;
  onResize: (size: 'small' | 'medium' | 'large') => void;
}

export const AreaChartWidget = ({
  widgetKey,
  name,
  description,
  size,
  sizeOptions = ['medium', 'large'],
  dateRange,
  onRemove,
  onResize
}: AreaChartWidgetProps) => {
  const { data, loading, total } = useChartWidgetData(widgetKey, dateRange);

  const getHeight = () => {
    switch (size) {
      case 'small': return 200;
      case 'medium': return 250;
      case 'large': return 300;
      default: return 250;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{name}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sizeOptions.includes('medium') && size !== 'medium' && (
              <DropdownMenuItem onClick={() => onResize('medium')}>
                <Minimize2 className="mr-2 h-4 w-4" />
                Tamanho médio
              </DropdownMenuItem>
            )}
            {sizeOptions.includes('large') && size !== 'large' && (
              <DropdownMenuItem onClick={() => onResize('large')}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Tamanho grande
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full" style={{ height: getHeight() }} />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height: getHeight() }}>
            Sem dados no período
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold mb-2">{total}</div>
            <ResponsiveContainer width="100%" height={getHeight()}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`gradient-${widgetKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill={`url(#gradient-${widgetKey})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
};
