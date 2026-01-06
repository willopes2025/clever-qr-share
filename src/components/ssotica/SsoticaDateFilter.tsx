import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export type SsoticaPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface SsoticaDateRange {
  from: Date;
  to: Date;
}

interface SsoticaDateFilterProps {
  value: SsoticaDateRange;
  onChange: (range: SsoticaDateRange) => void;
}

const periods: { key: SsoticaPeriod; label: string; days: number }[] = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
];

export const SsoticaDateFilter = ({ value, onChange }: SsoticaDateFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<SsoticaPeriod>('30d');

  const handlePeriodClick = (period: SsoticaPeriod, days: number) => {
    setSelectedPeriod(period);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const from = days === 0 ? new Date() : subDays(today, days);
    from.setHours(0, 0, 0, 0);
    onChange({ from, to: today });
  };

  const handleCustomSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setSelectedPeriod('custom');
      onChange({ from: range.from, to: range.to });
      setIsOpen(false);
    } else if (range?.from) {
      setSelectedPeriod('custom');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {periods.map((period) => (
        <Button
          key={period.key}
          variant={selectedPeriod === period.key ? "default" : "outline"}
          size="sm"
          onClick={() => handlePeriodClick(period.key, period.days)}
        >
          {period.label}
        </Button>
      ))}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedPeriod === 'custom' ? "default" : "outline"}
            size="sm"
            className={cn("gap-2")}
          >
            <CalendarIcon className="h-4 w-4" />
            {selectedPeriod === 'custom' 
              ? `${format(value.from, "dd/MM", { locale: ptBR })} - ${format(value.to, "dd/MM", { locale: ptBR })}`
              : "Personalizado"
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value.from}
            selected={{ from: value.from, to: value.to }}
            onSelect={handleCustomSelect}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
