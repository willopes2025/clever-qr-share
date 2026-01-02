import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from '@/hooks/useFinancialMetrics';

interface FinancialDateFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

type PresetKey = 'today' | '7days' | '30days' | '90days' | 'thisMonth' | 'lastMonth' | 'custom';

const presets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7days', label: '7 dias' },
  { key: '30days', label: '30 dias' },
  { key: '90days', label: '90 dias' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
];

const getPresetRange = (key: PresetKey): DateRange => {
  const today = new Date();
  
  switch (key) {
    case 'today':
      return { start: startOfDay(today), end: endOfDay(today) };
    case '7days':
      return { start: startOfDay(subDays(today, 6)), end: endOfDay(today) };
    case '30days':
      return { start: startOfDay(subDays(today, 29)), end: endOfDay(today) };
    case '90days':
      return { start: startOfDay(subDays(today, 89)), end: endOfDay(today) };
    case 'thisMonth':
      return { start: startOfMonth(today), end: endOfDay(today) };
    case 'lastMonth':
      const lastMonth = subMonths(today, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    default:
      return { start: startOfDay(subDays(today, 29)), end: endOfDay(today) };
  }
};

const detectActivePreset = (range: DateRange): PresetKey => {
  const today = new Date();
  
  for (const preset of presets) {
    const presetRange = getPresetRange(preset.key);
    if (
      format(range.start, 'yyyy-MM-dd') === format(presetRange.start, 'yyyy-MM-dd') &&
      format(range.end, 'yyyy-MM-dd') === format(presetRange.end, 'yyyy-MM-dd')
    ) {
      return preset.key;
    }
  }
  
  return 'custom';
};

export const FinancialDateFilter = ({ dateRange, onDateRangeChange }: FinancialDateFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const activePreset = detectActivePreset(dateRange);

  const handlePresetClick = (key: PresetKey) => {
    if (key !== 'custom') {
      onDateRangeChange(getPresetRange(key));
    }
  };

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) {
      onDateRangeChange({
        start: startOfDay(range.from),
        end: endOfDay(range.to || range.from),
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.key)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'justify-start text-left font-normal text-xs',
              activePreset === 'custom' && 'min-w-[200px]'
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {activePreset === 'custom' ? (
              <>
                {format(dateRange.start, 'dd/MM/yy', { locale: ptBR })} - {format(dateRange.end, 'dd/MM/yy', { locale: ptBR })}
              </>
            ) : (
              'Personalizado'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.start}
            selected={{ from: dateRange.start, to: dateRange.end }}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Show selected range text */}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {format(dateRange.start, "dd 'de' MMM", { locale: ptBR })} até {format(dateRange.end, "dd 'de' MMM, yyyy", { locale: ptBR })}
      </span>
    </div>
  );
};
