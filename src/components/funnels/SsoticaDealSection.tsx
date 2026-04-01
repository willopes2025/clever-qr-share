import { useState } from "react";
import { 
  Glasses, RefreshCw, ChevronDown, ChevronUp, FileText, 
  ShoppingCart, CreditCard, AlertCircle, Clock, ExternalLink,
  Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface SsoticaDealSectionProps {
  syncedData: Record<string, unknown> | null;
  isSyncing: boolean;
  error: string | null;
  onForceSync: () => void;
  hasSsotica: boolean;
}

export const SsoticaDealSection = ({
  syncedData,
  isSyncing,
  error,
  onForceSync,
  hasSsotica,
}: SsoticaDealSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showAllOs, setShowAllOs] = useState(false);
  const [showAllVendas, setShowAllVendas] = useState(false);
  const [showAllParcelas, setShowAllParcelas] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!hasSsotica) return null;

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value && value !== 0) return '-';
    return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'secondary';
    const s = status.toLowerCase();
    if (s.includes('conclu') || s.includes('entregue') || s.includes('pago') || s.includes('finaliz')) return 'default';
    if (s.includes('aberto') || s.includes('pendente') || s.includes('andamento')) return 'secondary';
    if (s.includes('vencid') || s.includes('atras') || s.includes('cancel')) return 'destructive';
    return 'secondary';
  };

  const isOverdue = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    try {
      return new Date(dateStr) < new Date();
    } catch {
      return false;
    }
  };

  const lastSyncFormatted = syncedData?.ssotica_ultima_sync
    ? formatDate(syncedData.ssotica_ultima_sync as string)
    : null;

  // Parse all lists
  let allOs: any[] = [];
  let allVendas: any[] = [];
  let allParcelas: any[] = [];
  try {
    allOs = syncedData?.ssotica_todas_os ? JSON.parse(syncedData.ssotica_todas_os as string) : [];
    allVendas = syncedData?.ssotica_todas_vendas ? JSON.parse(syncedData.ssotica_todas_vendas as string) : [];
    allParcelas = syncedData?.ssotica_todas_parcelas ? JSON.parse(syncedData.ssotica_todas_parcelas as string) : [];
  } catch {}

  return (
    <div className="border-t pt-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto hover:bg-transparent">
              <Glasses className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">ssOtica</span>
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          
          <div className="flex items-center gap-2">
            {lastSyncFormatted && (
              <span className="text-[10px] text-muted-foreground">
                {lastSyncFormatted}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onForceSync}
              disabled={isSyncing}
              title="Sincronizar ssOtica"
            >
              <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
            </Button>
          </div>
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Loading State */}
          {isSyncing && !syncedData && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Buscando dados do ssOtica...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
            </div>
          )}

          {/* Summary Badges */}
          {syncedData && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <FileText className="h-3 w-3" />
                  {(syncedData.ssotica_total_os as number) || 0} OS
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {(syncedData.ssotica_total_vendas as number) || 0} Vendas
                </Badge>
                <Badge 
                  variant={(syncedData.ssotica_total_parcelas_abertas as number) > 0 ? "destructive" : "outline"} 
                  className="text-[10px] gap-1"
                >
                  <CreditCard className="h-3 w-3" />
                  {(syncedData.ssotica_total_parcelas_abertas as number) || 0} Parcelas
                  {(syncedData.ssotica_valor_total_aberto as number) > 0 && (
                    <span className="ml-0.5">
                      ({formatCurrency(syncedData.ssotica_valor_total_aberto as number)})
                    </span>
                  )}
                </Badge>
              </div>

              {/* === OS Section === */}
              {allOs.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShowAllOs(!showAllOs)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    Ordens de Serviço ({allOs.length})
                    {showAllOs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  
                  {/* Show first OS always, rest if expanded */}
                  {(showAllOs ? allOs : allOs.slice(0, 1)).map((os: any, idx: number) => (
                    <div key={idx} className="bg-muted/50 rounded-md p-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">OS #{os.numero_os || os.numero || os.id}</span>
                        <Badge variant={getStatusColor(os.status) as any} className="text-[10px]">
                          {os.status || 'N/A'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                        <span>Entrada: {formatDate(os.data_entrada)}</span>
                        <span>Entrega: {formatDate(os.previsao_entrega)}</span>
                        {os.valor_total && <span className="col-span-2">Valor: {formatCurrency(parseFloat(os.valor_total))}</span>}
                        {os.observacoes && <span className="col-span-2 truncate">Obs: {os.observacoes}</span>}
                      </div>
                    </div>
                  ))}
                  {!showAllOs && allOs.length > 1 && (
                    <button
                      onClick={() => setShowAllOs(true)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      + {allOs.length - 1} mais
                    </button>
                  )}
                </div>
              )}

              {/* === Vendas Section === */}
              {allVendas.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShowAllVendas(!showAllVendas)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Vendas ({allVendas.length})
                    {showAllVendas ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  
                  {(showAllVendas ? allVendas : allVendas.slice(0, 1)).map((v: any, idx: number) => (
                    <div key={idx} className="bg-muted/50 rounded-md p-2 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Venda #{v.numero_venda || v.numero || v.id}</span>
                        {v.status && (
                          <Badge variant={getStatusColor(v.status) as any} className="text-[10px]">
                            {v.status}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                        <span>Data: {formatDate(v.data_venda)}</span>
                        <span>Valor: {formatCurrency(parseFloat(v.valor_total))}</span>
                        {v.forma_pagamento && <span className="col-span-2">Pagamento: {v.forma_pagamento}</span>}
                      </div>
                    </div>
                  ))}
                  {!showAllVendas && allVendas.length > 1 && (
                    <button
                      onClick={() => setShowAllVendas(true)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      + {allVendas.length - 1} mais
                    </button>
                  )}
                </div>
              )}

              {/* === Parcelas Section === */}
              {allParcelas.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShowAllParcelas(!showAllParcelas)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CreditCard className="h-3 w-3" />
                    Parcelas em Aberto ({allParcelas.length})
                    {showAllParcelas ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  
                  {(showAllParcelas ? allParcelas : allParcelas.slice(0, 2)).map((p: any, idx: number) => {
                    const vencimento = p.vencimento || p.data_vencimento;
                    const overdue = isOverdue(vencimento);
                    
                    return (
                      <div key={idx} className={cn(
                        "rounded-md p-2 space-y-1 text-xs",
                        overdue ? "bg-destructive/10 border border-destructive/20" : "bg-muted/50"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {p.documento || p.numero_parcela || `Parcela ${idx + 1}`}
                          </span>
                          <div className="flex items-center gap-1">
                            {overdue && <Clock className="h-3 w-3 text-destructive" />}
                            <span className={cn("font-semibold", overdue && "text-destructive")}>
                              {formatCurrency(parseFloat(p.valor || p.valor_parcela))}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className={overdue ? "text-destructive" : ""}>
                            Venc: {formatDate(vencimento)}
                          </span>
                          <Badge variant={overdue ? "destructive" : "secondary"} className="text-[10px]">
                            {p.status || (overdue ? 'Vencida' : 'Em aberto')}
                          </Badge>
                        </div>
                        
                        {/* Actions: Boleto & PIX */}
                        <div className="flex gap-1.5 pt-0.5">
                          {(p.boleto_url || p.link_boleto) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 text-[10px] px-1.5"
                              onClick={() => window.open(p.boleto_url || p.link_boleto, '_blank')}
                            >
                              <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
                              Boleto
                            </Button>
                          )}
                          {(p.pix_copia_cola || p.pix) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 text-[10px] px-1.5"
                              onClick={() => copyToClipboard(p.pix_copia_cola || p.pix, `pix-${idx}`)}
                            >
                              {copiedField === `pix-${idx}` ? (
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              PIX
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!showAllParcelas && allParcelas.length > 2 && (
                    <button
                      onClick={() => setShowAllParcelas(true)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      + {allParcelas.length - 2} mais
                    </button>
                  )}
                </div>
              )}

              {/* No data found */}
              {allOs.length === 0 && allVendas.length === 0 && allParcelas.length === 0 && !isSyncing && !error && (
                <div className="text-xs text-muted-foreground py-1">
                  Nenhum dado encontrado no ssOtica para este contato.
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
