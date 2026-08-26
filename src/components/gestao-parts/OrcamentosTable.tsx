import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Clock, Loader2, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ResultSearch } from "./ResultSearch";
import { brDate, filterRecords, money, num, pick, text, toRecords } from "./utils";

export interface OrcamentoRow {
  numpedido?: string;
  serie?: string;
  empresa?: string;
  despessoa?: string;
  codpessoa?: string;
  dtemis?: string;
  hremis?: string;
  total?: number | null;
  vendedor?: string;
  itens?: Array<Record<string, unknown>>;
  fones?: Record<string, unknown>;
  formaspagamento?: Array<Record<string, unknown>>;
  envio?: {
    status?: string;
    sent_at?: string | null;
    error_message?: string | null;
  } | null;
  [key: string]: unknown;
}

interface Props {
  rows: OrcamentoRow[];
  emptyMessage?: string;
  onSent?: () => void;
}

const itemTotal = (item: Record<string, unknown>): number | null => {
  const direct = num(pick(item, ["valortotal", "totalitem", "valor_total"]));
  if (direct !== null) return direct;
  const q = num(pick(item, ["quantidade", "qtde", "qtd"]));
  const u = num(pick(item, ["valorunitario", "valorunit", "preco"]));
  return q !== null && u !== null ? q * u : null;
};

const EnvioBadge = ({ envio }: { envio?: OrcamentoRow["envio"] }) => {
  const status = envio?.status;
  if (status === "sent") {
    return (
      <Badge variant="secondary" className="font-normal gap-1">
        <Check className="h-3 w-3" /> Enviado
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="font-normal gap-1">
        <TriangleAlert className="h-3 w-3" /> Falhou
      </Badge>
    );
  }
  if (status === "processing" || status === "pending") {
    return (
      <Badge variant="outline" className="font-normal gap-1">
        <Clock className="h-3 w-3" /> Em fila
      </Badge>
    );
  }
  return <span className="text-muted-foreground">Não enviado</span>;
};

export const OrcamentosTable = ({ rows, emptyMessage = "Nenhum orçamento encontrado", onSent }: Props) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrcamentoRow | null>(null);
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => filterRecords(rows, query), [rows, query]);
  const itens = toRecords(selected?.itens, ["itens"]);
  const totalItens = itens.reduce((s, i) => s + (itemTotal(i) ?? 0), 0);
  const jaEnviado = selected?.envio?.status === "sent";

  const enviar = async () => {
    if (!selected?.numpedido) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-parts-orcamentos-send", {
        body: { numero: String(selected.numpedido), row: selected, force: jaEnviado },
      });
      if (error) throw error;
      if (data?.status === "sent") {
        toast.success(`Orçamento ${selected.numpedido} enviado ao cliente`);
        setSelected({ ...selected, envio: { status: "sent", sent_at: new Date().toISOString() } });
        onSent?.();
      } else if (data?.status === "skipped") {
        toast.info(data.reason || "Envio ignorado");
      } else {
        toast.error(data?.reason || data?.error || "Não foi possível enviar o orçamento");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!rows.length) {
    return <div className="text-center py-10 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-2">
      <ResultSearch
        value={query}
        onChange={setQuery}
        placeholder="Filtrar por nº, cliente, vendedor, valor..."
        shown={filtered.length}
        total={rows.length}
        label="orçamento(s)"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum registro corresponde a "{query}"
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Orçamento</TableHead>
                <TableHead className="whitespace-nowrap">Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Vendedor</TableHead>
                <TableHead className="whitespace-nowrap">Envio</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => (
                <TableRow
                  key={`${row.numpedido ?? i}-${i}`}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="text-xs font-medium whitespace-nowrap">{text(row.numpedido)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {brDate(row.dtemis)}
                    {row.hremis ? <span className="text-muted-foreground"> {String(row.hremis).slice(0, 5)}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs min-w-[200px]">{text(row.despessoa)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {text(row.vendedor) || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <EnvioBadge envio={row.envio} />
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap font-medium">{money(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">Orçamento {text(selected?.numpedido)}</SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-base font-semibold">{money(selected.total ?? totalItens)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Itens</p>
                  <p className="text-base font-semibold">{itens.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data / hora" value={`${brDate(selected.dtemis)} ${text(selected.hremis)}`} />
                <Field label="Empresa" value={text(selected.empresa)} />
                <Field label="Cliente" value={text(selected.despessoa)} />
                <Field label="Cód. cliente" value={text(selected.codpessoa)} />
                <Field label="Vendedor" value={text(selected.vendedor) || "—"} />
                <Field
                  label="Envio"
                  value={
                    selected.envio?.status === "sent"
                      ? `Enviado em ${new Date(selected.envio.sent_at || "").toLocaleString("pt-BR")}`
                      : selected.envio?.error_message || "Não enviado"
                  }
                />
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Itens do orçamento</p>
                <div className="rounded-md border divide-y">
                  {itens.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground">Sem itens retornados pelo ERP.</p>
                  )}
                  {itens.map((item, i) => (
                    <div key={i} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {text(pick(item, ["descricao", "desproduto", "produto", "despeca", "nome"]))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {text(pick(item, ["quantidade", "qtde", "qtd"]))} x{" "}
                          {money(num(pick(item, ["valorunitario", "valorunit", "preco"])))}
                        </p>
                      </div>
                      <span className="text-xs font-medium whitespace-nowrap">{money(itemTotal(item))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={enviar} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {jaEnviado ? "Reenviar orçamento" : "Enviar orçamento"}
              </Button>
              {jaEnviado && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Este orçamento já foi enviado. O reenvio é manual e intencional.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-xs font-medium break-words">{value || "—"}</p>
  </div>
);
