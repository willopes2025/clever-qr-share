import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Code2, Loader2 } from "lucide-react";
import { ResultSearch } from "./ResultSearch";
import { AbrirChatButton, bestPhone } from "./AbrirChatButton";
import { cn } from "@/lib/utils";
import { brDate, filterRecords, money, num, pick, text, toRecords } from "./utils";


export interface PedidoRow {
  numpedido?: string;
  serie?: string;
  tipo?: string;
  empresa?: string;
  codpessoa?: string;
  despessoa?: string;
  status?: string;
  dtemis?: string;
  hremis?: string;
  total?: number | null;
  nfe_numero?: string;
  nfe_serie?: string;
  nfe_chave?: string;
  endereco?: Record<string, unknown>;
  fones?: Record<string, unknown>;
  formaspagamento?: Array<Record<string, unknown>>;
  itens?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface PedidosTableProps {
  rows: PedidoRow[];
  emptyMessage?: string;
  raw?: unknown;
}

const itemTotal = (item: Record<string, unknown>): number | null => {
  const direct = num(pick(item, ["valortotal", "totalitem", "valor_total"]));
  if (direct !== null) return direct;
  const q = num(pick(item, ["quantidade", "qtde", "qtd"]));
  const u = num(pick(item, ["valorunitario", "valorunit", "preco"]));
  return q !== null && u !== null ? q * u : null;
};

/** O ERP nem sempre preenche "status"; tentamos as variações conhecidas */
const pedidoStatus = (row: PedidoRow): string => {
  const v = pick(row as Record<string, unknown>, [
    "status",
    "statuspedido",
    "statusseparacao",
    "situacao",
    "dessituacao",
    "descstatus",
    "desstatus",
  ]);
  const s = String(v ?? "").trim();
  if (s) return s;
  // Pedido já faturado: a NF-e emitida é o melhor indicativo disponível
  return row.nfe_numero ? "FATURADO" : "";
};
/** O nome do vendedor muda de campo/estrutura conforme a rota do ERP */
const pedidoVendedor = (row: PedidoRow): string => {
  const record = row as Record<string, unknown>;

  // Rotas novas devolvem arrays/objetos aninhados (vendedorpedido, etc.)
  for (const key of ["vendedorpedido", "vendedorfaturamento", "vendedorcomissionado"]) {
    const value = record[key];
    const list = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
    for (const entry of list) {
      const o = entry as Record<string, unknown>;
      const nome = o?.nome ?? o?.descricao ?? o?.desvendedor ?? o?.nomevendedor;
      if (typeof nome === "string" && nome.trim()) return nome.trim();
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return String(pick(record, [
    "desvendedor",
    "vendedor",
    "nomevendedor",
    "vendedornome",
    "codvendedor",
  ]) ?? "").trim();
};

/**
 * O campo "status" do feed do ERP é o status de SEPARAÇÃO
 * (AGUARDANDO SEPARAÇÃO / SEPARADO / CONFERIDO), não o status comercial.
 * A situação comercial é deduzida da NF-e e do status de cada item.
 */
type StatusKind = "cancelado" | "parcial" | "faturado" | "atendido" | "andamento" | "outro";

const normalize = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

/** O ERP marca o cancelamento no item (ex.: "ITCD - ITEM TOTALMENTE CANCELADO DEVOLVIDO") */
export const itemCancelado = (item: Record<string, unknown>): boolean => {
  const s = normalize(
    pick(item, ["statusitempedido", "status", "situacao", "dessituacao", "descstatus"]),
  );
  return s.includes("CANCEL");
};

/** Item totalmente atendido (ITA) */
const itemAtendido = (item: Record<string, unknown>): boolean =>
  normalize(pick(item, ["statusitempedido", "status"])).includes("ATENDIDO");

/** Status de separação, exatamente como o ERP devolve */
const pedidoSeparacao = (row: PedidoRow): string =>
  String(pick(row as Record<string, unknown>, ["status", "statusseparacao"]) ?? "").trim();

const temNfe = (row: PedidoRow): boolean =>
  Boolean(String(row.nfe_numero ?? "").trim() || String(row.nfe_chave ?? "").trim());

/** Situação comercial do pedido */
const statusKind = (row: PedidoRow): StatusKind => {
  const record = row as Record<string, unknown>;
  const flag = record.cancelado;
  if (flag === true || normalize(flag) === "S" || normalize(flag) === "SIM") return "cancelado";
  if (String(record.dtcancelamento ?? record.datacancelamento ?? "").trim()) return "cancelado";
  if (normalize(pedidoStatus(row)).includes("CANCEL")) return "cancelado";

  const itens = toRecords(record.itens, ["itens"]);
  if (itens.length) {
    const cancelados = itens.filter(itemCancelado).length;
    if (cancelados === itens.length) return "cancelado";
    if (cancelados > 0) return "parcial";
    if (temNfe(row)) return "faturado";
    if (itens.every(itemAtendido)) return "atendido";
    return "andamento";
  }

  if (temNfe(row)) return "faturado";
  return "outro";
};

const SITUACAO_LABEL: Record<StatusKind, string> = {
  cancelado: "CANCELADO",
  parcial: "PARCIALMENTE CANCELADO",
  faturado: "FATURADO",
  atendido: "ATENDIDO",
  andamento: "EM ANDAMENTO",
  outro: "—",
};

/** Texto exibido na etiqueta de situação */
const statusLabel = (row: PedidoRow): string => SITUACAO_LABEL[statusKind(row)];

/** Chave da NF-e formatada em grupos de 4 */
export const formatChaveNfe = (chave: unknown): string =>
  String(chave ?? "")
    .replace(/\D/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();

type SituacaoFilter = "todos" | StatusKind;

export const PedidosTable = ({ rows, emptyMessage = "Nenhum pedido encontrado", raw }: PedidosTableProps) => {
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState("");
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilter>("todos");
  const [selected, setSelected] = useState<PedidoRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filtered = useMemo(() => {
    const base = filterRecords(rows, query) as PedidoRow[];
    if (situacaoFilter === "todos") return base;
    return base.filter((r) => statusKind(r) === situacaoFilter);
  }, [rows, query, situacaoFilter]);

  /** Contagem por situação, para montar apenas os filtros que existem na lista */
  const situacaoCounts = useMemo(() => {
    const counts = {} as Record<StatusKind, number>;
    rows.forEach((r) => {
      const k = statusKind(r);
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [rows]);


  const openDetail = (row: PedidoRow) => {
    setSelected(row);
    // Os dados do pedido já vêm no feed; damos um instante de loading para o
    // pop-up abrir suave e para permitir consultas futuras sem mudar a UI.
    setLoadingDetail(true);
    setTimeout(() => setLoadingDetail(false), 250);
  };

  if (!rows.length) {
    return <div className="text-center py-10 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  const itens = toRecords(selected?.itens, ["itens"]);
  const totalItens = itens.reduce((s, i) => s + (itemTotal(i) ?? 0), 0);
  const selectedKind = selected ? statusKind(selected) : "outro";
  const selectedCancelado = selectedKind === "cancelado" || selectedKind === "parcial";



  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <ResultSearch
            value={query}
            onChange={setQuery}
            placeholder="Filtrar por nº, cliente, status, valor..."
            shown={filtered.length}
            total={rows.length}
            label="pedido(s)"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={situacaoFilter === "todos" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSituacaoFilter("todos")}
          >
            Todos ({rows.length})
          </Button>
          {(["cancelado", "parcial", "faturado", "atendido", "andamento"] as StatusKind[])
            .filter((k) => (situacaoCounts[k] ?? 0) > 0)
            .map((k) => (
              <Button
                key={k}
                variant={situacaoFilter === k ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSituacaoFilter(k)}
              >
                {SITUACAO_LABEL[k]} ({situacaoCounts[k]})
              </Button>
            ))}
        </div>
        {raw !== undefined && (
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
            <Code2 className="h-3.5 w-3.5 mr-1.5" />
            {showRaw ? "Ver tabela" : "Ver JSON"}
          </Button>
        )}
      </div>

      {showRaw ? (
        <ScrollArea className="h-[420px] rounded-md border bg-muted/30">
          <pre className="p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(raw, null, 2)}</pre>
        </ScrollArea>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum registro corresponde ao filtro atual
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Pedido</TableHead>
                <TableHead className="whitespace-nowrap">Data</TableHead>
                <TableHead className="whitespace-nowrap">Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Vendedor</TableHead>

                <TableHead className="whitespace-nowrap">Situação</TableHead>
                <TableHead className="whitespace-nowrap">Separação</TableHead>
                <TableHead className="whitespace-nowrap">NF-e</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => {
                const kind = statusKind(row);
                const cancelado = kind === "cancelado";
                const destaque = cancelado || kind === "parcial";
                return (
                <TableRow
                  key={`${row.numpedido ?? i}-${i}`}
                  className={cn(
                    "cursor-pointer",
                    destaque && "bg-destructive/10 hover:bg-destructive/15",
                  )}
                  onClick={() => openDetail(row)}
                >

                  <TableCell
                    className={cn(
                      "text-xs font-medium whitespace-nowrap",
                      cancelado && "line-through text-muted-foreground",
                    )}
                  >
                    {text(row.numpedido)}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {brDate(row.dtemis)}
                    {row.hremis ? <span className="text-muted-foreground"> {String(row.hremis).slice(0, 5)}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{text(row.tipo)}</TableCell>
                  <TableCell className="text-xs min-w-[220px]">{text(row.despessoa)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {pedidoVendedor(row) || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {kind === "outro" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={destaque ? "destructive" : "secondary"}
                        className={cn(
                          "font-normal gap-1",
                          kind === "parcial" && "bg-destructive/20 text-destructive hover:bg-destructive/25",
                          kind === "faturado" && "bg-primary/15 text-primary hover:bg-primary/20",
                        )}
                      >
                        {destaque && <AlertTriangle className="h-3 w-3" />}
                        {statusLabel(row)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {pedidoSeparacao(row) ? (
                      <Badge variant="outline" className="font-normal">
                        {pedidoSeparacao(row)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {text(row.nfe_numero) || (String(row.nfe_chave ?? "").trim() ? "Sim" : <span className="text-muted-foreground">—</span>)}
                  </TableCell>



                  <TableCell
                    className={cn(
                      "text-xs text-right whitespace-nowrap font-medium",
                      cancelado && "line-through text-muted-foreground font-normal",
                    )}
                  >
                    {money(row.total)}
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
              Pedido {text(selected?.numpedido)} · {text(selected?.tipo)}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-3">
              <AbrirChatButton
                phone={bestPhone(selected)}
                name={text(selected.despessoa)}
                extraFields={{ erp_codigo: text(selected.codpessoa) }}
              />
            </div>
          )}

          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              {selectedCancelado && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">
                    {selectedKind === "parcial"
                      ? "Pedido com itens cancelados — confira os itens abaixo."
                      : "Pedido cancelado — não considerar como venda válida."}

                  </span>
                </div>
              )}

              {loadingDetail ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando dados do pedido...
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  {/* Resumo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Valor do pedido</p>
                      <p className="text-base font-semibold">{money(selected.total)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Itens</p>
                      <p className="text-base font-semibold">{itens.length}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Data / hora" value={`${brDate(selected.dtemis)} ${text(selected.hremis)}`} />
                    <Field label="Situação" value={statusLabel(selected)} />
                    <Field label="Separação" value={pedidoSeparacao(selected) || "—"} />
                    <Field label="Empresa" value={text(selected.empresa)} />
                    <Field label="Série" value={text(selected.serie)} />
                    <Field label="Cliente" value={text(selected.despessoa)} />
                    <Field label="Cód. cliente" value={text(selected.codpessoa)} />
                    <Field label="Vendedor" value={pedidoVendedor(selected) || "—"} />
                  </div>

                  {/* Nota fiscal */}
                  {(selected.nfe_numero || selected.nfe_chave) && (
                    <NotaFiscalBlock pedido={selected} />
                  )}


                  {/* Contato */}
                  {selected.fones && Object.values(selected.fones).some((v) => String(v ?? "").trim()) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Telefones</p>
                      <p className="text-xs">
                        {Object.values(selected.fones as Record<string, unknown>)
                          .map((v) => String(v ?? "").trim())
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  )}

                  {/* Endereço */}
                  {selected.endereco && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                      <p className="text-xs">
                        {[
                          pick(selected.endereco, ["endereco"]),
                          pick(selected.endereco, ["numero"]),
                          pick(selected.endereco, ["complemento"]),
                          pick(selected.endereco, ["bairro"]),
                          pick(selected.endereco, ["cidade"]),
                          pick(selected.endereco, ["estado"]),
                          pick(selected.endereco, ["cep"]),
                        ]
                          .map((v) => (v === undefined ? "" : String(v)))
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </p>
                    </div>
                  )}

                  {/* Pagamento */}
                  {Array.isArray(selected.formaspagamento) && selected.formaspagamento.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Formas de pagamento</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(
                          new Set(
                            selected.formaspagamento.map((f) => String(pick(f, ["descricao", "codigo"]) ?? "-")),
                          ),
                        ).map((d, i) => (
                          <Badge key={i} variant="outline" className="font-normal">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Itens */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Itens do pedido</p>
                    {itens.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum item retornado pelo ERP.</p>
                    ) : (
                      <div className="rounded-lg border divide-y">
                        {itens.map((item, i) => {
                          const cancel = itemCancelado(item);
                          return (
                          <div key={i} className={cn("p-2.5 space-y-1", cancel && "bg-destructive/10")}>
                            <div className="flex items-start justify-between gap-3">
                              <p className={cn("text-xs font-medium", cancel && "line-through text-muted-foreground")}>
                                {text(pick(item, ["descricaoproduto", "descricao"]))}
                              </p>
                              <span
                                className={cn(
                                  "text-xs font-semibold whitespace-nowrap",
                                  cancel && "line-through text-muted-foreground font-normal",
                                )}
                              >
                                {money(itemTotal(item))}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {[
                                pick(item, ["codigo"]) ? `Cód. ${text(pick(item, ["codigo"]))}` : null,
                                pick(item, ["marca"]) ? String(pick(item, ["marca"])) : null,
                                pick(item, ["codfabricante"]) ? `Fab. ${text(pick(item, ["codfabricante"]))}` : null,
                                `${num(pick(item, ["quantidade", "qtde"])) ?? "-"} x ${money(pick(item, ["valorunitario", "preco"]))}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {pick(item, ["statusitempedido"]) ? (
                              <p
                                className={cn(
                                  "text-[11px] flex items-center gap-1",
                                  cancel ? "text-destructive font-medium" : "text-muted-foreground",
                                )}
                              >
                                {cancel && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                {String(pick(item, ["statusitempedido"]))}
                              </p>
                            ) : null}
                          </div>
                          );
                        })}

                        <div className="flex items-center justify-between p-2.5 bg-muted/40">
                          <span className="text-xs font-medium">Total dos itens</span>
                          <span className="text-xs font-semibold">{money(totalItens)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xs font-medium break-all">{value}</p>
  </div>
);
