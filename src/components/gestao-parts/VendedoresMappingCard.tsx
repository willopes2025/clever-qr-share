import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, DownloadCloud, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { callGestaoParts, GestaoPartsPaged } from "@/hooks/useGestaoParts";

interface VendedorRow {
  id: string;
  codvendedor: string | null;
  nome: string;
  user_id: string | null;
}

const NONE = "__none__";

/** Extrai recursivamente o primeiro nome válido de estruturas de vendedor do ERP */
const pickVendedores = (record: Record<string, unknown>): { codvendedor: string | null; nome: string }[] => {
  const out: { codvendedor: string | null; nome: string }[] = [];
  const push = (codigo: unknown, nome: unknown) => {
    const n = typeof nome === "string" ? nome.trim() : "";
    if (!n) return;
    const c = typeof codigo === "string" || typeof codigo === "number" ? String(codigo).trim() : "";
    out.push({ codvendedor: c || null, nome: n });
  };

  for (const key of ["vendedorpedido", "vendedorfaturamento", "vendedorcomissionado"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          push(o.codigo ?? o.codvendedor, o.nome ?? o.descricao);
        }
      }
    }
  }
  if (typeof record.vendedor === "string") push(record.codvendedor, record.vendedor);
  return out;
};

const daysAgoISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

export const VendedoresMappingCard = () => {
  const { members } = useTeamMembers();
  const [rows, setRows] = useState<VendedorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newCodigo, setNewCodigo] = useState("");
  const [newNome, setNewNome] = useState("");

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active" && m.user_id),
    [members],
  );

  const load = async () => {
    const { data, error } = await supabase
      .from("gestao_parts_vendedores")
      .select("id, codvendedor, nome, user_id")
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as VendedorRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setUser = async (row: VendedorRow, userId: string) => {
    const value = userId === NONE ? null : userId;
    setSavingId(row.id);
    const { error } = await supabase
      .from("gestao_parts_vendedores")
      .update({ user_id: value })
      .eq("id", row.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, user_id: value } : r)));
    toast.success("Vínculo atualizado");
  };

  const remove = async (row: VendedorRow) => {
    const { error } = await supabase.from("gestao_parts_vendedores").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const addManual = async () => {
    const nome = newNome.trim();
    if (!nome) return toast.error("Informe o nome do vendedor");
    const { data, error } = await supabase
      .from("gestao_parts_vendedores")
      .insert({ nome, codvendedor: newCodigo.trim() || null })
      .select("id, codvendedor, nome, user_id")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) setRows((prev) => [...prev, data as VendedorRow].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNewCodigo("");
    setNewNome("");
  };

  const importFromErp = async () => {
    setImporting(true);
    try {
      const found = new Map<string, { codvendedor: string | null; nome: string }>();

      // Janelas curtas e sequenciais: o ERP devolve o pedido inteiro (com itens),
      // então períodos longos estouram o limite de memória da função.
      const windows = [
        { dtinicio: daysAgoISO(10), dtfinal: todayISO() },
        { dtinicio: daysAgoISO(20), dtfinal: daysAgoISO(11) },
        { dtinicio: daysAgoISO(30), dtfinal: daysAgoISO(21) },
      ];

      let anySuccess = false;
      for (const w of windows) {
        try {
          const data = await callGestaoParts<GestaoPartsPaged>("list_pedidos", {
            bloco: 1,
            tipopedido: ["ORCAMENTO"],
            ...w,
          });
          anySuccess = true;
          for (const item of data?.items || []) {
            for (const v of pickVendedores(item as Record<string, unknown>)) {
              const key = (v.codvendedor || v.nome).toLowerCase();
              if (!found.has(key)) found.set(key, v);
            }
          }
        } catch {
          // segue para a próxima janela
        }
      }

      if (!anySuccess) throw new Error("Não foi possível consultar o ERP agora. Tente novamente.");


      const existing = new Set(rows.map((r) => (r.codvendedor || r.nome).toLowerCase()));
      const missing = [...found.entries()].filter(([key]) => !existing.has(key)).map(([, v]) => v);

      if (missing.length === 0) {
        toast.info("Nenhum vendedor novo encontrado no ERP");
        return;
      }

      const { error } = await supabase.from("gestao_parts_vendedores").insert(missing);
      if (error) throw new Error(error.message);
      toast.success(`${missing.length} vendedor(es) importado(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar vendedores");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendedores do ERP × usuários do sistema</CardTitle>
        <CardDescription>
          Vincule cada vendedor da Gestão Parts a um usuário da equipe. O vínculo define quem responde os
          leads e quem aparece como responsável nos pedidos e orçamentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={importFromErp} disabled={importing}>
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4 mr-2" />
            )}
            Importar do ERP
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum vendedor cadastrado. Use "Importar do ERP" para trazer os vendedores dos últimos 60 dias
              ou adicione manualmente abaixo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Vendedor (ERP)</TableHead>
                  <TableHead className="w-64">Usuário do sistema</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      {row.codvendedor || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{row.nome}</TableCell>
                    <TableCell>
                      <Select
                        value={row.user_id || NONE}
                        onValueChange={(v) => setUser(row, v)}
                        disabled={savingId === row.id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Não vinculado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Não vinculado</SelectItem>
                          {activeMembers.map((m) => (
                            <SelectItem key={m.user_id!} value={m.user_id!}>
                              {m.profile?.full_name || m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(row)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end border-t pt-4">
          <div className="space-y-1.5 w-full sm:w-32">
            <Label>Código</Label>
            <Input value={newCodigo} onChange={(e) => setNewCodigo(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label>Nome do vendedor</Label>
            <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Como aparece no ERP" />
          </div>
          <Button variant="outline" onClick={addManual} disabled={!newNome.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
