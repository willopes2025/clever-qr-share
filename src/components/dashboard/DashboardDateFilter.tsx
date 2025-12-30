import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DateRange } from '@/hooks/useAdvancedDashboardMetrics';

interface DashboardDateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const options: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export function DashboardDateFilter({ value, onChange }: DashboardDateFilterProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-3 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
