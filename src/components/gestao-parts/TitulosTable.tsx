import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, Loader2 } from "lucide-react";
import { ResultSearch } from "./ResultSearch";
import { brDate, filterRecords, money, num, pick, text } from "./utils";
import { cn } from "@/lib/utils";

export type TituloRow = Record<string, unknown>;

interface TitulosTableProps {
  rows: TituloRow[];
  emptyMessage?: string;
  raw?: unknown;
  compact?: boolean;
}

const valorTitulo = (row: TituloRow): number | null =>
  num(pick(row, ["valor", "valortitulo", "valordocumento", "vlrtitulo"]));

const valorSaldo = (row: TituloRow): number | null => {
  const s = num(pick(row, ["valorsaldo", "saldo", "vlrsaldo", "saldodevedor"]));
  return s !== null ? s : valorTitulo(row);
};

const valorPago = (row: TituloRow): number | null =>
  num(pick(row, ["valorpago", "valorrecebido", "vlrpago"]));

const vencimento = (row: TituloRow): string =>
  String(pick(row, ["dtvencimento", "vencimento", "datavencimento"]) ?? "");

const parseDate = (v: string): Date | null => {
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  return null;
};

const daysOverdue = (row: TituloRow): number | null => {
  const d = parseDate(vencimento(row));
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
};

type Situacao = { label: string; tone: "paid" | "open" | "late" };

const situacao = (row: TituloRow): Situacao => {
  const raw = String(pick(row, ["situacao", "status", "dessituacao"]) ?? "").toLowerCase();
  const saldo = valorSaldo(row) ?? 0;
  if (raw.includes("pag") || raw.includes("quit") || raw.includes("baix") || saldo <= 0) {
    return { label: "Pago", tone: "paid" };
  }
  const late = daysOverdue(row);
  if (late !== null && late > 0) return { label: `Vencido ${late}d`, tone: "late" };
  return { label: "Em aberto", tone: "open" };
};

const toneClass = (tone: Situacao["tone"]) =>
  tone === "paid"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : tone === "late"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : "bg-amber-500/10 text-amber-600 border-amber-500/20";

export const TitulosTable = ({
  rows,
  emptyMessage = "Nenhum título encontrado",
  raw,
  compact = false,
}: TitulosTableProps) => {
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TituloRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filtered = useMemo(() => filterRecords(rows, query), [rows, query]);

  const totals = useMemo(() => {
    let total = 0;
    let aberto = 0;
    let vencido = 0;
    for (const row of filtered) {
      total += valorTitulo(row) ?? 0;
      const s = situacao(row);
      if (s.tone !== "paid") aberto += valorSaldo(row) ?? 0;
      if (s.tone === "late") vencido += valorSaldo(row) ?? 0;
    }
    return { total, aberto, vencido };
  }, [filtered]);

  const openDetail = (row: TituloRow) => {
    setSelected(row);
    setLoadingDetail(true);
    setTimeout(() => setLoadingDetail(false), 250);
  };

  if (!rows.length) {
    return <div className="text-center py-10 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <ResultSearch
            value={query}
            onChange={setQuery}
            placeholder="Filtrar por duplicata, cliente, situação, valor..."
            shown={filtered.length}
            total={rows.length}
            label="título(s)"
          />
        </div>
        {raw !== undefined && (
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
            <Code2 className="h-3.5 w-3.5 mr-1.5" />
            {showRaw ? "Ver tabela" : "Ver JSON"}
          </Button>
        )}
      </div>

      {!showRaw && (
        <div className="grid grid-cols-3 gap-2">
          <Summary label="Total" value={money(totals.total)} />
          <Summary label="Em aberto" value={money(totals.aberto)} className="text-amber-600" />
          <Summary label="Vencido" value={money(totals.vencido)} className="text-destructive" />
        </div>
      )}

      {showRaw ? (
        <ScrollArea className="h-[420px] rounded-md border bg-muted/30">
          <pre className="p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(raw, null, 2)}</pre>
        </ScrollArea>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum registro corresponde a "{query}"
        </div>
      ) : (
        <ScrollArea className={cn("rounded-md border", compact ? "h-[260px]" : "h-[420px]")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Documento</TableHead>
                <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                {!compact && <TableHead>Cliente</TableHead>}
                <TableHead className="whitespace-nowrap">Situação</TableHead>
                <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                <TableHead className="text-right whitespace-nowrap">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => {
                const s = situacao(row);
                return (
                  <TableRow key={i} className="cursor-pointer" onClick={() => openDetail(row)}>
                    <TableCell className="text-xs font-medium whitespace-nowrap">
                      {text(pick(row, ["numeroduplicata", "documento", "numerodocumento", "planilha"]))}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{brDate(vencimento(row))}</TableCell>
                    {!compact && (
                      <TableCell className="text-xs min-w-[200px]">
                        {text(pick(row, ["despessoa", "cliente", "nomecliente", "nome"]))}
                      </TableCell>
                    )}
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge variant="outline" className={cn("font-normal", toneClass(s.tone))}>
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">{money(valorTitulo(row))}</TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap font-medium">
                      {money(valorSaldo(row))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              Título {selected ? text(pick(selected, ["numeroduplicata", "documento", "planilha"])) : ""}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              {loadingDetail ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dados do título...
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Valor do título</p>
                      <p className="text-base font-semibold">{money(valorTitulo(selected))}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Saldo em aberto</p>
                      <p className="text-base font-semibold">{money(valorSaldo(selected))}</p>
                    </div>
                  </div>

                  <div>
                    <Badge variant="outline" className={cn("font-normal", toneClass(situacao(selected).tone))}>
                      {situacao(selected).label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vencimento" value={brDate(vencimento(selected))} />
                    <Field
                      label="Emissão"
                      value={brDate(pick(selected, ["dtemissao", "emissao", "dataemissao"]))}
                    />
                    <Field
                      label="Pagamento"
                      value={brDate(pick(selected, ["dtpagamento", "dtbaixa", "datapagamento"]))}
                    />
                    <Field label="Valor pago" value={money(valorPago(selected))} />
                    <Field label="Cliente" value={text(pick(selected, ["despessoa", "cliente", "nomecliente", "nome"]))} />
                    <Field label="Cód. cliente" value={text(pick(selected, ["codpessoa", "codcliente", "cliente"]))} />
                    <Field label="Empresa" value={text(pick(selected, ["empresa", "codempresa"]))} />
                    <Field label="Planilha" value={text(pick(selected, ["planilha"]))} />
                    <Field
                      label="Forma de pagamento"
                      value={text(pick(selected, ["formapagamento", "desformapagamento", "tipodocumento"]))}
                    />
                    <Field label="Parcela" value={text(pick(selected, ["parcela", "numparcela"]))} />
                  </div>

                  {pick(selected, ["observacao", "obs", "historico"]) ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Observação</p>
                      <p className="text-xs">{text(pick(selected, ["observacao", "obs", "historico"]))}</p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Summary = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div className="rounded-lg border p-2.5">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className={cn("text-sm font-semibold", className)}>{value}</p>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xs font-medium break-all">{value}</p>
  </div>
);
