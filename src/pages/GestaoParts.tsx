import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cog, Settings, Search, Loader2, AlertCircle, ChevronLeft, ChevronRight, PlugZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useGestaoParts,
  GestaoPartsAction,
  GestaoPartsPaged,
  PEDIDO_TIPOS,
  PedidoTipo,
} from "@/hooks/useGestaoParts";
import { GestaoPartsTable } from "@/components/gestao-parts/GestaoPartsTable";
import { PecasTable, PecaRow } from "@/components/gestao-parts/PecasTable";
import { PedidosTable, PedidoRow } from "@/components/gestao-parts/PedidosTable";
import { TitulosTable, TituloRow } from "@/components/gestao-parts/TitulosTable";
import { ClientesTable, ClienteRow } from "@/components/gestao-parts/ClientesTable";
import { OrcamentosTable, OrcamentoRow } from "@/components/gestao-parts/OrcamentosTable";
import { OrcamentoAutoCard } from "@/components/gestao-parts/OrcamentoAutoCard";
import { VendedoresMappingCard } from "@/components/gestao-parts/VendedoresMappingCard";
import { useAdmin } from "@/hooks/useAdmin";
import { useOrganization } from "@/hooks/useOrganization";




const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const TIPO_LABEL: Record<PedidoTipo, string> = {
  ORCAMENTO: "Orçamento",
  CONDICIONAL: "Condicional",
  "PRE-VENDA": "Pré-venda",
  "E-COMMERCE": "E-commerce",
};

const isPaged = (v: unknown): v is GestaoPartsPaged =>
  !!v && typeof v === "object" && Array.isArray((v as GestaoPartsPaged).items);

const GestaoParts = () => {
  const { isAdmin: hasAdminRole } = useAdmin();
  const { organization, currentMember } = useOrganization();
  const isOwnerOrAdmin =
    hasAdminRole ||
    currentMember?.role === "admin" ||
    (!!organization?.owner_id && organization.owner_id === currentMember?.user_id);
  const isAdmin = isOwnerOrAdmin;
  const { hasGestaoParts, isLoading: isLoadingStatus, call } = useGestaoParts();
  const [activeTab, setActiveTab] = useState("pedidos");

  const [orcConfigOpen, setOrcConfigOpen] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Peças
  const [peca, setPeca] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [codFabricante, setCodFabricante] = useState("");
  const [codbarra, setCodbarra] = useState("");
  const [codigoErp, setCodigoErp] = useState("");
  const [placa, setPlaca] = useState("");

  // Catálogo de produtos
  const [catalogoCodigo, setCatalogoCodigo] = useState("");
  const [catalogoMarca, setCatalogoMarca] = useState("");
  const [catalogoGrupo, setCatalogoGrupo] = useState("");
  const [catalogoBloco, setCatalogoBloco] = useState(1);

  // Clientes
  const [clienteBusca, setClienteBusca] = useState("");
  const [clientesBloco, setClientesBloco] = useState(1);

  // Funil de status (webhook + sincronização)
  const [statusBusy, setStatusBusy] = useState(false);

  const registrarWebhook = async () => {
    setStatusBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-parts-webhook-register", {
        body: { action: "register" },
      });
      if (error) throw error;
      const results = (data as { data?: { results?: Array<{ ok: boolean }> } })?.data?.results || [];
      const ok = results.filter((r) => r.ok).length;
      toast.success(`Webhook registrado no ERP (${ok}/${results.length} endpoints)`);
    } catch (e) {
      toast.error("Erro ao registrar webhook: " + (e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const sincronizarStatus = async () => {
    setStatusBusy(true);
    try {
      const { error } = await supabase.functions.invoke("gestao-parts-sync-status", {
        body: { days: 20, source: "manual_sync" },
      });
      if (error) throw error;
      toast.success("Sincronização silenciosa iniciada — os cards serão atualizados sem enviar mensagens");
    } catch (e) {
      toast.error("Erro ao sincronizar status: " + (e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  // Pedidos
  const [pedidoInicio, setPedidoInicio] = useState(daysAgoISO(30));
  const [pedidoFim, setPedidoFim] = useState(todayISO());
  const [pedidoTipos, setPedidoTipos] = useState<PedidoTipo[]>([...PEDIDO_TIPOS]);
  const [pedidoBloco, setPedidoBloco] = useState(1);
  const [pedidoNumero, setPedidoNumero] = useState("");
  const [pedidoCpf, setPedidoCpf] = useState("");

  // Orçamentos
  const [orcInicio, setOrcInicio] = useState(daysAgoISO(7));
  const [orcFim, setOrcFim] = useState(todayISO());
  const [orcVendedor, setOrcVendedor] = useState("");
  const [orcBloco, setOrcBloco] = useState(1);
  const [orcNumero, setOrcNumero] = useState("");


  // Financeiro
  const [finCliente, setFinCliente] = useState("");
  const [finVencInicio, setFinVencInicio] = useState(daysAgoISO(30));
  const [finVencFim, setFinVencFim] = useState(todayISO());
  const [finBloco, setFinBloco] = useState(1);
  const [finEmpresa, setFinEmpresa] = useState("");
  const [boletoEmpresa, setBoletoEmpresa] = useState("");
  const [boletoPlanilha, setBoletoPlanilha] = useState("");

  const run = async (key: string, action: GestaoPartsAction, params: Record<string, unknown>) => {
    setLoadingKey(key);
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      const data = await call(action, params);
      setResults((r) => ({ ...r, [key]: data }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors((e) => ({ ...e, [key]: message }));
      toast.error(message);
    } finally {
      setLoadingKey(null);
    }
  };

  const busy = (key: string) => loadingKey === key;

  const toggleTipo = (tipo: PedidoTipo) => {
    setPedidoTipos((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
  };

  const buscarPedidos = (bloco: number) => {
    setPedidoBloco(bloco);
    run("pedidos", "list_pedidos", {
      bloco,
      tipopedido: pedidoTipos.length ? pedidoTipos : [...PEDIDO_TIPOS],
      dtinicio: pedidoInicio,
      dtfinal: pedidoFim,
    });
  };

  const ORC_BLOCOS = 10; // blocos do ERP agregados por página

  const buscarOrcamentos = (bloco: number) => {
    setOrcBloco(bloco);
    run("orcamentos", "list_orcamentos", {
      bloco,
      blocos: ORC_BLOCOS,
      dtinicio: orcInicio,
      dtfinal: orcFim,
      ...(orcVendedor.trim() ? { vendedor: orcVendedor.trim() } : {}),
    });
  };

  const buscarOrcamentoPorId = () => {
    if (!orcNumero.trim()) return;
    run("orcamento-id", "get_orcamento", { numero: orcNumero.trim() });
  };

  const buscarClientes = (bloco: number) => {

    setClientesBloco(bloco);
    run("clientes", "list_clientes", { bloco, situacao: "T" });
  };

  const buscarFinanceiro = (bloco: number) => {
    setFinBloco(bloco);
    run("receber", "contas_receber", {
      bloco,
      cliente: finCliente,
      empresa: finEmpresa,
      dtvencimentoinicio: finVencInicio,
      dtvencimentofim: finVencFim,
    });
  };

  const CATALOGO_BLOCOS = 10; // blocos do ERP agregados por página (~10 peças cada)

  const buscarCatalogo = (bloco: number) => {
    setCatalogoBloco(bloco);
    run("catalogo", "peca_dados", {
      bloco: (bloco - 1) * CATALOGO_BLOCOS + 1,
      blocos: CATALOGO_BLOCOS,
      codigo: catalogoCodigo,
      marca: catalogoMarca,
      grupo: catalogoGrupo,
    });
  };


  /** Peças têm colunas próprias (imagem, preço, quantidade) */
  const renderPecas = (key: string, empty: string) => {
    const data = results[key];
    const rows = (isPaged(data) ? (data as GestaoPartsPaged).items : []) as PecaRow[];
    return (
      <>
        {errors[key] && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
          </Alert>
        )}
        {data === undefined ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Faça uma consulta para ver os resultados
          </div>
        ) : (
          <PecasTable rows={rows} emptyMessage={empty} raw={data} />
        )}
      </>
    );
  };

  /** Pedidos com colunas próprias, busca local e detalhe em pop-up */
  const renderPedidos = (key: string, empty: string) => {
    const data = results[key];
    const rows = (isPaged(data) ? (data as GestaoPartsPaged).items : []) as PedidoRow[];
    return (
      <>
        {errors[key] && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
          </Alert>
        )}
        {data === undefined ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Faça uma consulta para ver os resultados
          </div>
        ) : (
          <PedidosTable rows={rows} emptyMessage={empty} raw={data} />
        )}
      </>
    );
  };

  /** Financeiro: colunas próprias, totais, busca local e detalhe em pop-up */
  const renderTitulos = (key: string, empty: string) => {
    const data = results[key];
    const rows = (isPaged(data) ? (data as GestaoPartsPaged).items : []) as TituloRow[];
    return (
      <>
        {errors[key] && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
          </Alert>
        )}
        {data === undefined ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Faça uma consulta para ver os resultados
          </div>
        ) : (
          <TitulosTable rows={rows} emptyMessage={empty} raw={data} />
        )}
      </>
    );
  };

  /** Clientes: busca local, colunas principais, detalhe e criação de lead */
  const renderClientes = (key: string, empty: string) => {
    const data = results[key];
    const rows = (isPaged(data)
      ? (data as GestaoPartsPaged).items
      : data && typeof data === "object"
        ? [data as ClienteRow]
        : []) as ClienteRow[];
    return (
      <>
        {errors[key] && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
          </Alert>
        )}
        {data === undefined ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Faça uma consulta para ver os resultados
          </div>
        ) : (
          <ClientesTable rows={rows} emptyMessage={empty} raw={data} />
        )}
      </>
    );
  };

  /** Orçamentos: colunas próprias, status de envio e disparo manual */
  const renderOrcamentos = (key: string, empty: string) => {
    const data = results[key];
    const rows = (isPaged(data) ? (data as GestaoPartsPaged).items : []) as OrcamentoRow[];
    return (
      <>
        {errors[key] && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
          </Alert>
        )}
        {data === undefined ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Faça uma consulta para ver os resultados
          </div>
        ) : (
          <OrcamentosTable
            rows={rows}
            emptyMessage={empty}
            onSent={() => (key === "orcamento-id" ? buscarOrcamentoPorId() : buscarOrcamentos(orcBloco))}
          />
        )}
      </>
    );
  };









  const renderPagination = (key: string, bloco: number, onChange: (b: number) => void) => {
    const data = results[key];
    if (!isPaged(data) || !data.totalblocos) return null;
    return (
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">
          Bloco {data.blocoatual || bloco} de {data.totalblocos}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={bloco <= 1 || busy(key)}
            onClick={() => onChange(bloco - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bloco >= data.totalblocos || busy(key)}
            onClick={() => onChange(bloco + 1)}
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderResult = (key: string, empty: string) => (
    <>
      {errors[key] && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
        </Alert>
      )}
      {results[key] !== undefined ? (
        <>
          {isPaged(results[key]) && (results[key] as GestaoPartsPaged).message && (
            <Alert className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {(results[key] as GestaoPartsPaged).message}
              </AlertDescription>
            </Alert>
          )}
          <GestaoPartsTable
            data={isPaged(results[key]) ? (results[key] as GestaoPartsPaged).items : results[key]}
            emptyMessage={empty}
          />
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Faça uma consulta para ver os resultados
        </div>
      )}
    </>
  );

  if (isLoadingStatus) {
    return (
      <AppLayout pageTitle="Gestão Parts">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasGestaoParts) {
    return (
      <AppLayout pageTitle="Gestão Parts">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Cog className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Gestão Parts não conectado</h2>
          <p className="text-muted-foreground max-w-md">
            Conecte o ERP Gestão Parts em Configurações → Integrações para consultar peças,
            clientes, pedidos e financeiro por aqui.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Gestão Parts">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cog className="h-7 w-7 text-primary" />
              Gestão Parts
            </h1>
            <p className="text-muted-foreground">
              Consultas ao ERP SSPlus: pedidos, clientes, financeiro, peças, estoque e preços
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={statusBusy} onClick={registrarWebhook}>
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Registrar webhook de status
            </Button>
            <Button variant="outline" size="sm" disabled={statusBusy} onClick={sincronizarStatus}>
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar status sem mensagens
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>

            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="pecas">Peças</TabsTrigger>
          </TabsList>

          {/* -------------------- PEDIDOS -------------------- */}
          <TabsContent value="pedidos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por período</CardTitle>
                <CardDescription>
                  Listagem paginada do ERP (feed v3). Selecione os tipos de pedido desejados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PEDIDO_TIPOS.map((tipo) => (
                    <Badge
                      key={tipo}
                      variant={pedidoTipos.includes(tipo) ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleTipo(tipo)}
                    >
                      {TIPO_LABEL[tipo]}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input type="date" value={pedidoInicio} onChange={(e) => setPedidoInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input type="date" value={pedidoFim} onChange={(e) => setPedidoFim(e.target.value)} />
                  </div>
                  <Button onClick={() => buscarPedidos(1)} disabled={busy("pedidos")}>
                    {busy("pedidos") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>

                {renderPedidos("pedidos", "Nenhum pedido no período para os tipos selecionados")}
                {renderPagination("pedidos", pedidoBloco, buscarPedidos)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status de um pedido</CardTitle>
                <CardDescription>Consulta pelo número do pedido no ERP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Número do pedido</Label>
                    <Input value={pedidoNumero} onChange={(e) => setPedidoNumero(e.target.value)} placeholder="Ex: 770851" />
                  </div>
                  <Button
                    onClick={() => run("pedido-status", "get_pedido_status", { pedido: pedidoNumero })}
                    disabled={busy("pedido-status") || !pedidoNumero}
                  >
                    {busy("pedido-status") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderResult("pedido-status", "Pedido não encontrado")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por CPF/CNPJ</CardTitle>
                <CardDescription>Disponível para pedidos de e-commerce, condicional e pré-venda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>CPF ou CNPJ</Label>
                    <Input value={pedidoCpf} onChange={(e) => setPedidoCpf(e.target.value)} placeholder="Somente números" />
                  </div>
                  <Button onClick={() => run("pedidos-cpf", "pedidos_cpf", { cpf: pedidoCpf })} disabled={busy("pedidos-cpf") || !pedidoCpf}>
                    {busy("pedidos-cpf") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderResult("pedidos-cpf", "Nenhum pedido para este documento")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- ORÇAMENTOS -------------------- */}
          <TabsContent value="orcamentos" className="space-y-4">
            {/* Configurações da integração são restritas a administradores */}
            {isAdmin && (
              <>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setOrcConfigOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </Button>
                </div>

                <Dialog open={orcConfigOpen} onOpenChange={setOrcConfigOpen}>
                  <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-base">Configurações da Gestão Parts</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="envio" className="w-full">
                      <TabsList>
                        <TabsTrigger value="envio">Envio</TabsTrigger>
                        <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
                      </TabsList>
                      <TabsContent value="envio" className="mt-4">
                        <OrcamentoAutoCard />
                      </TabsContent>
                      <TabsContent value="vendedores" className="mt-4">
                        <VendedoresMappingCard />
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              </>
            )}


            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buscar orçamento por ID</CardTitle>
                <CardDescription>Cole o número/código do orçamento gerado no ERP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Número do orçamento</Label>
                    <Input
                      value={orcNumero}
                      onChange={(e) => setOrcNumero(e.target.value)}
                      placeholder="Ex: 770851"
                      onKeyDown={(e) => e.key === "Enter" && buscarOrcamentoPorId()}
                    />
                  </div>
                  <Button onClick={buscarOrcamentoPorId} disabled={busy("orcamento-id") || !orcNumero.trim()}>
                    {busy("orcamento-id") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderOrcamentos("orcamento-id", "Orçamento não encontrado")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orçamentos por vendedor e período</CardTitle>
                <CardDescription>
                  Clique em uma linha para ver os detalhes e enviar o orçamento ao cliente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Vendedor</Label>
                    <Input
                      value={orcVendedor}
                      onChange={(e) => setOrcVendedor(e.target.value)}
                      placeholder="Vazio = todos os vendedores"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input type="date" value={orcInicio} onChange={(e) => setOrcInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input type="date" value={orcFim} onChange={(e) => setOrcFim(e.target.value)} />
                  </div>
                  <Button onClick={() => buscarOrcamentos(1)} disabled={busy("orcamentos")}>
                    {busy("orcamentos") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>

                {renderOrcamentos("orcamentos", "Nenhum orçamento no período")}
                {renderPagination("orcamentos", orcBloco, buscarOrcamentos)}
              </CardContent>
            </Card>
          </TabsContent>


          {/* -------------------- CLIENTES -------------------- */}
          <TabsContent value="clientes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consultar cadastro</CardTitle>
                <CardDescription>Telefone (DDD + número), CPF ou CNPJ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Telefone, CPF ou CNPJ</Label>
                    <Input value={clienteBusca} onChange={(e) => setClienteBusca(e.target.value)} placeholder="46988016163" />
                  </div>
                  <Button
                    onClick={() => run("pessoa", "check_pessoa", { documento: clienteBusca })}
                    disabled={busy("pessoa") || !clienteBusca}
                  >
                    {busy("pessoa") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderClientes("pessoa", "Cadastro não localizado no ERP")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Listagem de clientes</CardTitle>
                <CardDescription>Paginada por blocos do ERP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => buscarClientes(1)} disabled={busy("clientes")}>
                  {busy("clientes") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Carregar clientes
                </Button>
                {renderClientes("clientes", "Nenhum cliente retornado")}
                {renderPagination("clientes", clientesBloco, buscarClientes)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- FINANCEIRO -------------------- */}
          <TabsContent value="financeiro" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contas a receber</CardTitle>
                <CardDescription>Filtro por vencimento, empresa e/ou código do cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Vencimento de</Label>
                    <Input type="date" value={finVencInicio} onChange={(e) => setFinVencInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>até</Label>
                    <Input type="date" value={finVencFim} onChange={(e) => setFinVencFim(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empresa</Label>
                    <Input value={finEmpresa} onChange={(e) => setFinEmpresa(e.target.value)} placeholder="0001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código do cliente</Label>
                    <Input value={finCliente} onChange={(e) => setFinCliente(e.target.value)} placeholder="Opcional" />
                  </div>
                  <Button onClick={() => buscarFinanceiro(1)} disabled={busy("receber")}>
                    {busy("receber") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderTitulos("receber", "Nenhum título encontrado")}
                {renderPagination("receber", finBloco, buscarFinanceiro)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Boletos</CardTitle>
                <CardDescription>Informe empresa e planilha do título</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Empresa</Label>
                    <Input value={boletoEmpresa} onChange={(e) => setBoletoEmpresa(e.target.value)} placeholder="0001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Planilha</Label>
                    <Input value={boletoPlanilha} onChange={(e) => setBoletoPlanilha(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => run("boletos", "boletos", { empresa: boletoEmpresa, planilha: boletoPlanilha })}
                    disabled={busy("boletos") || !boletoEmpresa || !boletoPlanilha}
                  >
                    {busy("boletos") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar boletos
                  </Button>
                </div>
                {renderResult("boletos", "Nenhum boleto encontrado")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- PEÇAS -------------------- */}
          <TabsContent value="pecas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Busca rápida de peça</CardTitle>
                <CardDescription>
                  O ERP exige o veículo (ou código de fabricante/barras) nesta consulta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Veículo *</Label>
                    <Input value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Ex: GOL 2001 1.6" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Peça</Label>
                    <Input value={peca} onChange={(e) => setPeca(e.target.value)} placeholder="Ex: PASTILHA FREIO" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cód. fabricante</Label>
                    <Input value={codFabricante} onChange={(e) => setCodFabricante(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                <Button
                  onClick={() => run("peca", "search_peca", { peca, veiculo, codfabricante: codFabricante, codbarra: "", pessoa: "" })}
                  disabled={busy("peca") || (!veiculo && !codFabricante)}
                >
                  {busy("peca") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
                {renderPecas("peca", "Nenhuma peça encontrada")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Catálogo de produtos</CardTitle>
                <CardDescription>Listagem completa com código, descrição, marca e unidade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Código</Label>
                    <Input value={catalogoCodigo} onChange={(e) => setCatalogoCodigo(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Marca</Label>
                    <Input value={catalogoMarca} onChange={(e) => setCatalogoMarca(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Grupo</Label>
                    <Input value={catalogoGrupo} onChange={(e) => setCatalogoGrupo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
                <Button onClick={() => buscarCatalogo(1)} disabled={busy("catalogo")}>
                  {busy("catalogo") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Listar
                </Button>
                {renderPecas("catalogo", "Nenhum produto encontrado")}
                {renderPagination("catalogo", catalogoBloco, buscarCatalogo)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Peças por placa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Placa do veículo</Label>
                    <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" />
                  </div>
                  <Button onClick={() => run("placa", "peca_veiculo_placa", { placa })} disabled={busy("placa") || !placa}>
                    {busy("placa") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderPecas("placa", "Nenhum veículo/peça para esta placa")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Código de barras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Código de barras</Label>
                    <Input value={codbarra} onChange={(e) => setCodbarra(e.target.value)} placeholder="7891234567890" />
                  </div>
                  <Button onClick={() => run("barcode", "peca_barcode", { barcode: codbarra })} disabled={busy("barcode") || !codbarra}>
                    {busy("barcode") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderPecas("barcode", "Nenhum produto para este código de barras")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preço e estoque por código ERP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>Código ERP da peça</Label>
                    <Input value={codigoErp} onChange={(e) => setCodigoErp(e.target.value)} placeholder="Código interno" />
                  </div>
                  <Button variant="outline" onClick={() => run("preco", "peca_preco", { codigoerp: codigoErp })} disabled={busy("preco") || !codigoErp}>
                    {busy("preco") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Preço
                  </Button>
                  <Button variant="outline" onClick={() => run("estoque", "peca_estoque", { codigoerp: codigoErp })} disabled={busy("estoque") || !codigoErp}>
                    {busy("estoque") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Estoque
                  </Button>
                </div>
                {renderResult("preco", "Sem preço retornado")}
                {renderResult("estoque", "Sem estoque retornado")}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
};

export default GestaoParts;
