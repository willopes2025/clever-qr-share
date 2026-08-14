import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cog, Search, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useGestaoParts, GestaoPartsAction } from "@/hooks/useGestaoParts";
import { GestaoPartsTable } from "@/components/gestao-parts/GestaoPartsTable";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const GestaoParts = () => {
  const { hasGestaoParts, isLoading: isLoadingStatus, call } = useGestaoParts();
  const [activeTab, setActiveTab] = useState("pecas");

  // shared result state per tab
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Peças
  const [peca, setPeca] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [codbarra, setCodbarra] = useState("");
  const [codigoErp, setCodigoErp] = useState("");

  // Clientes
  const [clienteBusca, setClienteBusca] = useState("");

  // Pedidos
  const [pedidoInicio, setPedidoInicio] = useState(daysAgoISO(30));
  const [pedidoFim, setPedidoFim] = useState(todayISO());
  const [pedidoCpf, setPedidoCpf] = useState("");

  // Financeiro
  const [finCliente, setFinCliente] = useState("");
  const [finVencInicio, setFinVencInicio] = useState(daysAgoISO(30));
  const [finVencFim, setFinVencFim] = useState(todayISO());

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

  const renderResult = (key: string, empty: string) => (
    <>
      {errors[key] && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs break-all">{errors[key]}</AlertDescription>
        </Alert>
      )}
      {results[key] !== undefined ? (
        <GestaoPartsTable data={results[key]} emptyMessage={empty} />
      ) : (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Faça uma consulta para ver os resultados
        </div>
      )}
    </>
  );

  const busy = (key: string) => loadingKey === key;

  return (
    <AppLayout pageTitle="Gestão Parts">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cog className="h-7 w-7 text-primary" />
            Gestão Parts
          </h1>
          <p className="text-muted-foreground">
            Consultas ao ERP SSPlus: peças, estoque, preços, clientes, pedidos e financeiro
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pecas">Peças</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>

          {/* -------------------- PEÇAS -------------------- */}
          <TabsContent value="pecas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buscar peça</CardTitle>
                <CardDescription>Por descrição da peça e/ou veículo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Peça</Label>
                    <Input value={peca} onChange={(e) => setPeca(e.target.value)} placeholder="Ex: PASTILHA FREIO" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Veículo</Label>
                    <Input value={veiculo} onChange={(e) => setVeiculo(e.target.value)} placeholder="Ex: GOL 2001 1.6" />
                  </div>
                </div>
                <Button
                  onClick={() => run('peca', 'search_peca', { peca, veiculo, codfabricante: '', codbarra: '', pessoa: '' })}
                  disabled={busy('peca')}
                >
                  {busy('peca') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
                {renderResult('peca', 'Nenhuma peça encontrada')}
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
                  <Button onClick={() => run('barcode', 'peca_barcode', { barcode: codbarra })} disabled={busy('barcode') || !codbarra}>
                    {busy('barcode') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderResult('barcode', 'Nenhum produto para este código de barras')}
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
                  <Button variant="outline" onClick={() => run('preco', 'peca_preco', { codigoerp: codigoErp })} disabled={busy('preco') || !codigoErp}>
                    {busy('preco') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Preço
                  </Button>
                  <Button variant="outline" onClick={() => run('estoque', 'peca_estoque', { codigoerp: codigoErp })} disabled={busy('estoque') || !codigoErp}>
                    {busy('estoque') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Estoque
                  </Button>
                </div>
                {renderResult('preco', 'Sem preço retornado')}
                {renderResult('estoque', 'Sem estoque retornado')}
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
                    onClick={() => run('pessoa', 'check_pessoa', { documento: clienteBusca })}
                    disabled={busy('pessoa') || !clienteBusca}
                  >
                    {busy('pessoa') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Consultar
                  </Button>
                </div>
                {renderResult('pessoa', 'Cadastro não localizado no ERP')}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Listagem de clientes</CardTitle>
                <CardDescription>Bloco de até 1000 registros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => run('clientes', 'list_clientes', { bloco: 0, situacao: 'T' })} disabled={busy('clientes')}>
                  {busy('clientes') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Carregar clientes
                </Button>
                {renderResult('clientes', 'Nenhum cliente retornado')}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- PEDIDOS -------------------- */}
          <TabsContent value="pedidos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Início</Label>
                    <Input type="date" value={pedidoInicio} onChange={(e) => setPedidoInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim</Label>
                    <Input type="date" value={pedidoFim} onChange={(e) => setPedidoFim(e.target.value)} />
                  </div>
                  <Button
                    onClick={() => run('pedidos', 'list_pedidos', { dtinicio: pedidoInicio, dtfinal: pedidoFim })}
                    disabled={busy('pedidos')}
                  >
                    {busy('pedidos') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderResult('pedidos', 'Nenhum pedido no período')}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos por CPF/CNPJ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="space-y-1.5 flex-1">
                    <Label>CPF ou CNPJ</Label>
                    <Input value={pedidoCpf} onChange={(e) => setPedidoCpf(e.target.value)} placeholder="Somente números" />
                  </div>
                  <Button onClick={() => run('pedidos-cpf', 'pedidos_cpf', { cpf: pedidoCpf })} disabled={busy('pedidos-cpf') || !pedidoCpf}>
                    {busy('pedidos-cpf') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderResult('pedidos-cpf', 'Nenhum pedido para este documento')}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -------------------- FINANCEIRO -------------------- */}
          <TabsContent value="financeiro" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contas a receber</CardTitle>
                <CardDescription>Filtro por vencimento e/ou código do cliente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Vencimento de</Label>
                    <Input type="date" value={finVencInicio} onChange={(e) => setFinVencInicio(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>até</Label>
                    <Input type="date" value={finVencFim} onChange={(e) => setFinVencFim(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código do cliente</Label>
                    <Input value={finCliente} onChange={(e) => setFinCliente(e.target.value)} placeholder="Opcional" />
                  </div>
                  <Button
                    onClick={() => run('receber', 'contas_receber', {
                      bloco: 0,
                      cliente: finCliente,
                      dtvencimentoinicio: finVencInicio,
                      dtvencimentofim: finVencFim,
                    })}
                    disabled={busy('receber')}
                  >
                    {busy('receber') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar
                  </Button>
                </div>
                {renderResult('receber', 'Nenhum título encontrado')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default GestaoParts;
