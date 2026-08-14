import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Code2 } from "lucide-react";

interface GestaoPartsTableProps {
  data: unknown;
  emptyMessage?: string;
  maxColumns?: number;
}

/**
 * Tabela genérica para respostas do ERP Gestão Parts.
 * As respostas variam por endpoint, então as colunas são inferidas dos registros.
 */
export const GestaoPartsTable = ({
  data,
  emptyMessage = "Nenhum resultado encontrado",
  maxColumns = 8,
}: GestaoPartsTableProps) => {
  const [showRaw, setShowRaw] = useState(false);

  const rows = extractRows(data);

  if (!rows.length) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  const columns = Array.from(
    rows.slice(0, 20).reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => {
        if (typeof row[k] !== 'object' || row[k] === null) set.add(k);
      });
      return set;
    }, new Set<string>()),
  ).slice(0, maxColumns);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} registro(s)</span>
        <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
          <Code2 className="h-3.5 w-3.5 mr-1.5" />
          {showRaw ? "Ver tabela" : "Ver JSON"}
        </Button>
      </div>

      {showRaw ? (
        <ScrollArea className="h-[420px] rounded-md border bg-muted/30">
          <pre className="p-3 text-xs whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </ScrollArea>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap capitalize">
                    {col.replace(/_/g, ' ')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="whitespace-nowrap text-xs">
                      {formatValue(row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

export function extractRows(data: unknown): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter((d) => d && typeof d === 'object') as Array<Record<string, unknown>>;

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Procura a primeira propriedade que é uma lista de objetos
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value) && value.some((v) => v && typeof v === 'object')) {
        return value as Array<Record<string, unknown>>;
      }
    }
    return [obj];
  }

  return [];
}
