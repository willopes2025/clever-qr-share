import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useChartWidgetData, DateRange } from "@/hooks/useChartWidgetData";
import { Skeleton } from "@/components/ui/skeleton";

interface PieChartWidgetProps {
  widgetKey: string;
  name: string;
  description?: string;
  size: 'small' | 'medium' | 'large';
  sizeOptions?: string[];
  dateRange: DateRange;
  onRemove: () => void;
  onResize: (size: 'small' | 'medium' | 'large') => void;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))'
];

export const PieChartWidget = ({
  widgetKey,
  name,
  description,
  size,
  sizeOptions = ['small', 'medium'],
  dateRange,
  onRemove,
  onResize
}: PieChartWidgetProps) => {
  const { data, loading, total } = useChartWidgetData(widgetKey, dateRange);

  const getHeight = () => {
    switch (size) {
      case 'small': return 200;
      case 'medium': return 280;
      case 'large': return 350;
      default: return 200;
    }
  };

  const getRadius = () => {
    switch (size) {
      case 'small': return { inner: 40, outer: 70 };
      case 'medium': return { inner: 50, outer: 90 };
      case 'large': return { inner: 60, outer: 110 };
      default: return { inner: 40, outer: 70 };
    }
  };

  const radius = getRadius();

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
            {sizeOptions.includes('small') && size !== 'small' && (
              <DropdownMenuItem onClick={() => onResize('small')}>
                <Minimize2 className="mr-2 h-4 w-4" />
                Tamanho pequeno
              </DropdownMenuItem>
            )}
            {sizeOptions.includes('medium') && size !== 'medium' && (
              <DropdownMenuItem onClick={() => onResize('medium')}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Tamanho médio
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
        ) : data.length === 0 || total === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground" style={{ height: getHeight() }}>
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={getHeight()}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={radius.inner}
                outerRadius={radius.outer}
                paddingAngle={2}
                dataKey="value"
                nameKey="label"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [value, '']}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
