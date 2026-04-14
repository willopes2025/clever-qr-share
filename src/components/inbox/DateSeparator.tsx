import { getDateLabelBR } from "@/lib/date-utils";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = ({ date }: DateSeparatorProps) => {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted/80 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
        {getDateLabelBR(date)}
      </div>
    </div>
  );
};
