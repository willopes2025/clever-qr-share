import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';

interface DashboardDateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  customRange?: CustomDateRange;
  onCustomRangeChange?: (range: CustomDateRange) => void;
}

const presets: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export function DashboardDateFilter({ value, onChange, customRange, onCustomRangeChange }: DashboardDateFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && onCustomRangeChange) {
      onCustomRangeChange({ from: range.from, to: range.to || range.from });
      onChange('custom');
      if (range.to) {
        setIsCalendarOpen(false);
      }
    }
  };

  const formatCustomRange = () => {
    if (!customRange) return 'Personalizado';
    return `${format(customRange.from, 'dd/MM', { locale: ptBR })} - ${format(customRange.to, 'dd/MM', { locale: ptBR })}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {presets.map((option) => (
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

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-2',
              value === 'custom' && 'border-primary bg-primary/5'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {value === 'custom' ? formatCustomRange() : 'Personalizado'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={customRange ? { from: customRange.from, to: customRange.to } : undefined}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
            disabled={{ after: new Date() }}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
