import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ContactData {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
}

interface FieldRow {
  key: string;
  label: string;
  valueA: string;
  valueB: string;
}

interface MergeFieldComparisonProps {
  contactA: ContactData;
  contactB: ContactData;
  selections: Record<string, 'a' | 'b'>;
  onSelectionChange: (key: string, source: 'a' | 'b') => void;
}

const displayValue = (val: any): string => {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

export const buildFieldRows = (contactA: ContactData, contactB: ContactData): FieldRow[] => {
  const rows: FieldRow[] = [
    { key: '_name', label: 'Nome', valueA: displayValue(contactA.name), valueB: displayValue(contactB.name) },
    { key: '_phone', label: 'Telefone', valueA: displayValue(contactA.phone), valueB: displayValue(contactB.phone) },
    { key: '_email', label: 'Email', valueA: displayValue(contactA.email), valueB: displayValue(contactB.email) },
    { key: '_notes', label: 'Notas', valueA: displayValue(contactA.notes), valueB: displayValue(contactB.notes) },
  ];

  // Merge custom field keys from both contacts
  const allKeys = new Set<string>();
  if (contactA.custom_fields) Object.keys(contactA.custom_fields).forEach(k => allKeys.add(k));
  if (contactB.custom_fields) Object.keys(contactB.custom_fields).forEach(k => allKeys.add(k));

  allKeys.forEach(key => {
    const vA = contactA.custom_fields?.[key];
    const vB = contactB.custom_fields?.[key];
    rows.push({
      key: `cf_${key}`,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      valueA: displayValue(vA),
      valueB: displayValue(vB),
    });
  });

  return rows;
};

export const getAutoSelections = (rows: FieldRow[]): Record<string, 'a' | 'b'> => {
  const selections: Record<string, 'a' | 'b'> = {};
  rows.forEach(row => {
    const hasA = row.valueA !== '—';
    const hasB = row.valueB !== '—';
    if (hasA && !hasB) {
      selections[row.key] = 'a';
    } else if (!hasA && hasB) {
      selections[row.key] = 'b';
    } else if (row.valueA === row.valueB) {
      selections[row.key] = 'a';
    } else if (hasA) {
      // Default to A (keep conversation) but let user override
      selections[row.key] = 'a';
    }
  });
  return selections;
};

export const MergeFieldComparison = ({
  contactA,
  contactB,
  selections,
  onSelectionChange,
}: MergeFieldComparisonProps) => {
  const rows = buildFieldRows(contactA, contactB);

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_1fr] gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground border-b">
          <span>Campo</span>
          <span>Conversa atual</span>
          <span>Conversa duplicada</span>
        </div>

        {rows.map(row => {
          const same = row.valueA === row.valueB;
          const bothEmpty = row.valueA === '—' && row.valueB === '—';

          if (bothEmpty) return null;

          return (
            <div key={row.key} className="grid grid-cols-[140px_1fr_1fr] gap-2 px-2 py-1.5 items-center">
              <span className="text-xs font-medium text-muted-foreground truncate">{row.label}</span>

              {/* Value A */}
              <button
                type="button"
                onClick={() => !same && onSelectionChange(row.key, 'a')}
                disabled={same || row.valueA === '—'}
                className={cn(
                  "text-xs text-left px-2 py-1.5 rounded border transition-all min-h-[32px]",
                  selections[row.key] === 'a'
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/50",
                  (same || row.valueA === '—') && "cursor-default opacity-70"
                )}
              >
                {row.valueA}
              </button>

              {/* Value B */}
              <button
                type="button"
                onClick={() => !same && onSelectionChange(row.key, 'b')}
                disabled={same || row.valueB === '—'}
                className={cn(
                  "text-xs text-left px-2 py-1.5 rounded border transition-all min-h-[32px]",
                  selections[row.key] === 'b'
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/50",
                  (same || row.valueB === '—') && "cursor-default opacity-70"
                )}
              >
                {row.valueB}
              </button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
