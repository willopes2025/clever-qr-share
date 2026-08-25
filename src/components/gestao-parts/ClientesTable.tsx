import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Code2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFunnels } from "@/hooks/useFunnels";
import { ResultSearch } from "./ResultSearch";
import { brDate, filterRecords, money, num, pick, text } from "./utils";
import { toTitleCase } from "@/lib/utils";

export type ClienteRow = Record<string, unknown>;

interface ClientesTableProps {
  rows: ClienteRow[];
  emptyMessage?: string;
  raw?: unknown;
}

const nomeCliente = (row: ClienteRow): string =>
  String(pick(row, ["despessoa", "nome", "nomerazao", "razaosocial", "cliente", "fantasia"]) ?? "").trim();

const documento = (row: ClienteRow): string => {
  const v = pick(row, ["cnpj", "cpf", "cpfcnpj", "documento"]);
  return String(v ?? "").replace(/\D/g, "");
};

const telefone = (row: ClienteRow): string => {
  const direct = pick(row, ["celular", "telefone", "fone", "fone1", "telefone1", "whatsapp"]);
  if (direct) return String(direct).replace(/\D/g, "");
  const fones = row.fones;
  if (fones && typeof fones === "object") {
    for (const v of Object.values(fones as Record<string, unknown>)) {
      const digits = String(v ?? "").replace(/\D/g, "");
      if (digits.length >= 10) return digits;
    }
  }
  return "";
};

const emailCliente = (row: ClienteRow): string =>
  String(pick(row, ["email", "emailnfe", "email1"]) ?? "").trim();

const cidadeUf = (row: ClienteRow): string => {
  const end = (row.endereco && typeof row.endereco === "object" ? row.endereco : row) as Record<string, unknown>;
  const cidade = pick(end, ["cidade", "municipio", "descidade"]);
  const uf = pick(end, ["estado", "uf"]);
  return [cidade, uf].filter(Boolean).join(" / ");
};

const enderecoCompleto = (row: ClienteRow): string => {
  const end = (row.endereco && typeof row.endereco === "object" ? row.endereco : row) as Record<string, unknown>;
  return (
    [
      pick(end, ["endereco", "logradouro", "rua"]),
      pick(end, ["numero"]),
      pick(end, ["complemento"]),
      pick(end, ["bairro"]),
      pick(end, ["cidade", "municipio"]),
      pick(end, ["estado", "uf"]),
      pick(end, ["cep"]),
    ]
      .map((v) => (v === undefined ? "" : String(v).trim()))
      .filter(Boolean)
      .join(", ") || "-"
  );
};

const situacaoCliente = (row: ClienteRow): string => {
  const v = String(pick(row, ["situacao", "status", "dessituacao"]) ?? "").trim();
  if (!v) return "";
  const up = v.toUpperCase();
  if (up === "A" || up.startsWith("ATIV")) return "Ativo";
  if (up === "I" || up.startsWith("INAT")) return "Inativo";
  if (up === "B" || up.startsWith("BLOQ")) return "Bloqueado";
  return v;
};

const formatDoc = (digits: string): string => {
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return digits || "-";
};

const formatPhone = (digits: string): string => {
  if (!digits) return "-";
  const d = digits.replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
};

/** Telefone no padrão do CRM: 55 + DDD + número */
const toCrmPhone = (digits: string): string => {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
};

export const ClientesTable = ({ rows, emptyMessage = "Nenhum cliente retornado", raw }: ClientesTableProps) => {
  const { user } = useAuth();
  const { funnels, createDeal } = useFunnels({ includeDeals: false });
  const [showRaw, setShowRaw] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClienteRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [leadOpen, setLeadOpen] = useState(false);
  const [leadTarget, setLeadTarget] = useState<ClienteRow | null>(null);
  const [funnelId, setFunnelId] = useState("");
  const [stageId, setStageId] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => filterRecords(rows, query), [rows, query]);
  const stages = useMemo(
    () => funnels?.find((f) => f.id === funnelId)?.stages ?? [],
    [funnels, funnelId],
  );

  const openDetail = (row: ClienteRow) => {
    setSelected(row);
    setLoadingDetail(true);
    setTimeout(() => setLoadingDetail(false), 200);
  };

  const openLeadDialog = (row: ClienteRow) => {
    setLeadTarget(row);
    setLeadPhone(formatPhone(telefone(row)) === "-" ? "" : telefone(row));
    const firstFunnel = funnels?.[0];
    setFunnelId(firstFunnel?.id ?? "");
    setStageId(firstFunnel?.stages?.[0]?.id ?? "");
    setLeadOpen(true);
  };

  const criarLead = async () => {
    if (!leadTarget || !user?.id) return;
    const phone = toCrmPhone(leadPhone);
    if (phone.length < 12) {
      toast.error("Informe um telefone válido (DDD + número)");
      return;
    }
    if (!funnelId || !stageId) {
      toast.error("Selecione o funil e a etapa");
      return;
    }

    setCreating(true);
    try {
      const nome = toTitleCase(nomeCliente(leadTarget)) || "Cliente ERP";
      const doc = documento(leadTarget);
      const email = emailCliente(leadTarget);

      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();

      let contactId = existing?.id;

      if (!contactId) {
        const { data: created, error } = await supabase
          .from("contacts")
          .insert({
            user_id: user.id,
            name: nome,
            phone,
            email: email || null,
            custom_fields: {
              erp_codigo: text(pick(leadTarget, ["codigo", "codpessoa", "codcliente"])),
              ...(doc ? { [doc.length === 14 ? "cnpj" : "cpf"]: doc } : {}),
              origem: "Gestão Parts",
            } as never,
          })
          .select("id")
          .single();
        if (error) throw error;
        contactId = created.id;
      }

      await createDeal.mutateAsync({
        funnel_id: funnelId,
        stage_id: stageId,
        contact_id: contactId!,
        title: nome,
        source: "Gestão Parts",
        custom_fields: {
          erp_codigo: text(pick(leadTarget, ["codigo", "codpessoa", "codcliente"])),
          ...(doc ? { documento: doc } : {}),
        },
      });

      toast.success(`Lead criado para ${nome}`);
      setLeadOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar lead");
    } finally {
      setCreating(false);
    }
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
            placeholder="Filtrar por nome, CPF/CNPJ, cidade, telefone..."
            shown={filtered.length}
            total={rows.length}
            label="cliente(s)"
          />
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
          Nenhum registro corresponde a "{query}"
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="whitespace-nowrap">CPF / CNPJ</TableHead>
                <TableHead className="whitespace-nowrap">Telefone</TableHead>
                <TableHead className="whitespace-nowrap">Cidade / UF</TableHead>
                <TableHead className="whitespace-nowrap">Situação</TableHead>
                <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => (
                <TableRow key={i} className="cursor-pointer" onClick={() => openDetail(row)}>
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    {text(pick(row, ["codigo", "codpessoa", "codcliente"]))}
                  </TableCell>
                  <TableCell className="text-xs min-w-[220px]">{toTitleCase(nomeCliente(row)) || "-"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDoc(documento(row))}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatPhone(telefone(row))}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{cidadeUf(row) || "-"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {situacaoCliente(row) ? (
                      <Badge variant="secondary" className="font-normal">{situacaoCliente(row)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLeadDialog(row);
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      Criar lead
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Detalhe do cliente */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              {selected ? toTitleCase(nomeCliente(selected)) || "Cliente" : ""}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              {loadingDetail ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando cadastro...
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Código no ERP</p>
                      <p className="text-base font-semibold">
                        {text(pick(selected, ["codigo", "codpessoa", "codcliente"]))}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Limite de crédito</p>
                      <p className="text-base font-semibold">
                        {money(pick(selected, ["limitecredito", "limite", "vlrlimite"]))}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CPF / CNPJ" value={formatDoc(documento(selected))} />
                    <Field label="Situação" value={situacaoCliente(selected) || "-"} />
                    <Field label="Telefone" value={formatPhone(telefone(selected))} />
                    <Field label="E-mail" value={emailCliente(selected) || "-"} />
                    <Field label="Nome fantasia" value={text(pick(selected, ["fantasia", "nomefantasia"]))} />
                    <Field label="Inscrição estadual" value={text(pick(selected, ["inscricaoestadual", "ie", "rg"]))} />
                    <Field label="Cadastro" value={brDate(pick(selected, ["dtcadastro", "datacadastro"]))} />
                    <Field
                      label="Última atualização"
                      value={brDate(pick(selected, ["dtatualizacao", "dataatualizacao"]))}
                    />
                    <Field label="Vendedor" value={text(pick(selected, ["vendedor", "desvendedor"]))} />
                    <Field label="Empresa" value={text(pick(selected, ["empresa", "codempresa"]))} />
                    <Field
                      label="Condição de pagamento"
                      value={text(pick(selected, ["condicaopagamento", "descondicaopagamento"]))}
                    />
                    <Field
                      label="Tabela de preço"
                      value={text(pick(selected, ["tabelapreco", "destabelapreco"]))}
                    />
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                    <p className="text-xs">{enderecoCompleto(selected)}</p>
                  </div>

                  {num(pick(selected, ["saldodevedor", "saldo", "totalcompras"])) !== null && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Saldo devedor" value={money(pick(selected, ["saldodevedor", "saldo"]))} />
                      <Field label="Total comprado" value={money(pick(selected, ["totalcompras", "valorcompras"]))} />
                    </div>
                  )}

                  <Button className="w-full" onClick={() => openLeadDialog(selected)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar lead com estes dados
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Criar lead */}
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar lead a partir do cliente</DialogTitle>
          </DialogHeader>

          {leadTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-medium">{toTitleCase(nomeCliente(leadTarget)) || "Cliente"}</p>
                <p className="text-xs text-muted-foreground">
                  {[formatDoc(documento(leadTarget)), cidadeUf(leadTarget), emailCliente(leadTarget)]
                    .filter((v) => v && v !== "-")
                    .join(" · ")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Telefone (DDD + número)</Label>
                <Input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="27999999999"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Funil</Label>
                <Select
                  value={funnelId}
                  onValueChange={(v) => {
                    setFunnelId(v);
                    setStageId(funnels?.find((f) => f.id === v)?.stages?.[0]?.id ?? "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {(funnels ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={criarLead} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Criar lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xs font-medium break-all">{value}</p>
  </div>
);
