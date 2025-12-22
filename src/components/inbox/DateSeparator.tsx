import { isToday, isYesterday, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = ({ date }: DateSeparatorProps) => {
  const dateObj = new Date(date);

  const getDateLabel = () => {
    if (isToday(dateObj)) {
      return "Hoje";
    }
    if (isYesterday(dateObj)) {
      return "Ontem";
    }
    return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted/80 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
        {getDateLabel()}
      </div>
    </div>
  );
};
