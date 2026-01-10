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
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from '@/hooks/useWidgetData';

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

interface DashboardDateFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const presets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
];

export function DashboardDateFilter({ dateRange, onDateRangeChange }: DashboardDateFilterProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('7d');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePresetClick = (preset: PresetKey) => {
    setActivePreset(preset);
    const today = new Date();
    
    let newRange: DateRange;
    switch (preset) {
      case 'today':
        newRange = { start: startOfDay(today), end: endOfDay(today) };
        break;
      case '7d':
        newRange = { start: startOfDay(subDays(today, 6)), end: endOfDay(today) };
        break;
      case '30d':
        newRange = { start: startOfDay(subDays(today, 29)), end: endOfDay(today) };
        break;
      case '90d':
        newRange = { start: startOfDay(subDays(today, 89)), end: endOfDay(today) };
        break;
      case 'month':
        newRange = { start: startOfMonth(today), end: endOfDay(today) };
        break;
      default:
        return;
    }
    onDateRangeChange(newRange);
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) {
      setActivePreset('custom');
      onDateRangeChange({
        start: startOfDay(range.from),
        end: endOfDay(range.to || range.from)
      });
      if (range.to) {
        setIsCalendarOpen(false);
      }
    }
  };

  const formatDateRange = () => {
    if (activePreset !== 'custom') {
      return presets.find(p => p.key === activePreset)?.label || '';
    }
    return `${format(dateRange.start, 'dd/MM', { locale: ptBR })} - ${format(dateRange.end, 'dd/MM', { locale: ptBR })}`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preset buttons */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {presets.map((preset) => (
          <Button
            key={preset.key}
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 px-3 text-sm font-medium transition-all',
              activePreset === preset.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handlePresetClick(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Calendar popover for custom range */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-2',
              activePreset === 'custom' && 'border-primary'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {activePreset === 'custom' ? formatDateRange() : 'Personalizado'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: dateRange.start, to: dateRange.end }}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
