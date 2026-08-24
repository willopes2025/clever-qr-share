import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Code2, ImageOff, Loader2 } from "lucide-react";
import { callGestaoParts } from "@/hooks/useGestaoParts";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export interface PecaRow {
  codigo?: string;
  codigoerp?: string;
  descricao?: string;
  marca?: string;
  quantidade?: number | null;
  preco?: number | null;
  imagem?: string | null;
  unidadesaida?: string;
  codigofabricante?: string;
  codigobarras?: string;
  status?: string;
  aplicacao?: string;
  grupo?: string;
  subgrupo?: string;
  secao?: string;
  fornecedores?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface PecasTableProps {
  rows: PecaRow[];
  emptyMessage?: string;
  raw?: unknown;
}

const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "-";

const text = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() ? s : "-";
};

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Extrai lista de registros de qualquer formato retornado pelo ERP */
const toRecords = (raw: unknown): Record<string, unknown>[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["estoque", "estoques", "itens", "items", "precos", "preco", "tabelapreco", "pecas"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter((r) => r && typeof r === "object") as Record<string, unknown>[];
    }
    return [obj];
  }
  return [];
};

const pick = (rec: Record<string, unknown>, keys: string[]): unknown => {
  const lower = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

const QTY_KEYS = ["estoque", "estoquedisponivel", "quantidade", "qtde", "qtd", "estoqueatual", "estoque_atual", "saldo", "quantidadeatual", "disponivel"];
const PRICE_KEYS = ["preco", "precovenda", "preco_venda", "valor", "valorvenda", "precotabela"];
const LOCAL_KEYS = ["empresa", "empresanome", "filial", "deposito", "local", "almoxarifado", "loja", "codigoempresa"];
const RESERVED_KEYS = ["estoquereservado", "reservado"];
const TRANSIT_KEYS = ["estoquetransito", "transito"];


/** Soma o estoque total retornado pelo ERP */
const totalEstoque = (raw: unknown): number | null => {
  const recs = toRecords(raw);
  let total: number | null = null;
  for (const r of recs) {
    const q = num(pick(r, QTY_KEYS));
    if (q !== null) total = (total ?? 0) + q;
  }
  return total;
};

/** Primeiro preço válido retornado pelo ERP */
const pickPrice = (raw: unknown): unknown => {
  for (const r of toRecords(raw)) {
    const p = pick(r, PRICE_KEYS);
    if (p !== undefined) return p;
  }
  return undefined;
};



export const PecasTable = ({ rows, emptyMessage = "Nenhuma peça encontrada", raw }: PecasTableProps) => {
  const [showRaw, setShowRaw] = useState(false);
  const [selected, setSelected] = useState<PecaRow | null>(null);
  const [detail, setDetail] = useState<{ preco?: unknown; estoque?: unknown } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  if (!rows.length) {
    return <div className="text-center py-10 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  const openDetail = async (row: PecaRow) => {
    setSelected(row);
    setDetail(null);
    const cod = String(row.codigoerp || row.codigo || "").trim();
    if (!cod) return;
    setLoadingDetail(true);
    try {
      const [preco, estoque] = await Promise.all([
        callGestaoParts("peca_preco", { codigoerp: cod }).catch(() => null),
        callGestaoParts("peca_estoque", { codigoerp: cod }).catch(() => null),
      ]);
      setDetail({ preco, estoque });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} peça(s)</span>
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
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Img</TableHead>
                <TableHead className="whitespace-nowrap">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="whitespace-nowrap">Marca</TableHead>
                <TableHead className="whitespace-nowrap">Un.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Qtd.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow
                  key={`${row.codigo ?? i}-${i}`}
                  className="cursor-pointer"
                  onClick={() => openDetail(row)}
                >
                  <TableCell>
                    {row.imagem ? (
                      <img
                        src={row.imagem}
                        alt={text(row.descricao)}
                        loading="lazy"
                        className="h-9 w-9 rounded object-cover border"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded border flex items-center justify-center bg-muted/40">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap">{text(row.codigo)}</TableCell>
                  <TableCell className="text-xs min-w-[280px]">{text(row.descricao)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{text(row.marca)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{text(row.unidadesaida)}</TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {typeof row.quantidade === "number" ? row.quantidade.toLocaleString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">{money(row.preco)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{text(selected?.descricao)}</SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              {selected.imagem && (
                <img
                  src={selected.imagem}
                  alt={text(selected.descricao)}
                  className="w-full max-h-64 object-contain rounded border bg-muted/30"
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Código" value={text(selected.codigo)} />
                <Field label="Código ERP" value={text(selected.codigoerp)} />
                <Field label="Marca" value={text(selected.marca)} />
                <Field label="Unidade" value={text(selected.unidadesaida)} />
                <Field label="Cód. fabricante" value={text(selected.codigofabricante)} />
                <Field label="Cód. barras" value={text(selected.codigobarras)} />
                <Field label="Grupo" value={text(selected.grupo)} />
                <Field label="Seção" value={text(selected.secao)} />
              </div>

              {selected.status && <Badge variant="secondary">{String(selected.status)}</Badge>}

              {selected.aplicacao ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Aplicação</p>
                  <p className="text-xs">{String(selected.aplicacao)}</p>
                </div>
              ) : null}

              {Array.isArray(selected.fornecedores) && selected.fornecedores.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fornecedores</p>
                  <ul className="text-xs space-y-1">
                    {selected.fornecedores.map((f, i) => (
                      <li key={i}>{String(f.razaosocial ?? f.fantasia ?? f.fornecedor_codigo ?? "-")}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Preço e estoque no ERP</p>

                {loadingDetail ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando ERP...
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : detail ? (
                  <>
                    {/* Resumo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Preço de venda</p>
                        <p className="text-base font-semibold">
                          {money(num(pickPrice(detail.preco)) ?? num(selected.preco) ?? undefined)}
                        </p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Estoque total</p>
                        <p className="text-base font-semibold">
                          {totalEstoque(detail.estoque) !== null
                            ? `${totalEstoque(detail.estoque)!.toLocaleString("pt-BR")} ${text(selected.unidadesaida) !== "-" ? String(selected.unidadesaida) : ""}`.trim()
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Estoque por local */}
                    {toRecords(detail.estoque).length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {toRecords(detail.estoque).map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 p-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">
                                {text(pick(r, LOCAL_KEYS) ?? "Estoque disponível")}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[
                                  pick(r, ["codigoerp", "codigo"]) ? `Cód. ${text(pick(r, ["codigoerp", "codigo"]))}` : null,
                                  num(pick(r, RESERVED_KEYS)) !== null ? `Reservado: ${num(pick(r, RESERVED_KEYS))!.toLocaleString("pt-BR")}` : null,
                                  num(pick(r, TRANSIT_KEYS)) !== null ? `Em trânsito: ${num(pick(r, TRANSIT_KEYS))!.toLocaleString("pt-BR")}` : null,
                                ].filter(Boolean).join(" · ")}
                              </p>
                            </div>

                            <Badge variant={((num(pick(r, QTY_KEYS)) ?? 0) > 0) ? "secondary" : "outline"}>
                              {num(pick(r, QTY_KEYS)) !== null
                                ? num(pick(r, QTY_KEYS))!.toLocaleString("pt-BR")
                                : "-"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preços por tabela */}
                    {toRecords(detail.preco).length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {toRecords(detail.preco).map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 p-2.5">
                            <p className="text-xs truncate">
                              {text(pick(r, ["tabelapreco", "tabela", "descricao", "empresa"]) ?? "Preço")}
                            </p>
                            <span className="text-xs font-semibold whitespace-nowrap">
                              {money(num(pick(r, PRICE_KEYS)) ?? undefined)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem código ERP para consultar.</p>
                )}
              </div>

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
