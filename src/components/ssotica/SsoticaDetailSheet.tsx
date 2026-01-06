import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SsoticaDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: Record<string, any> | null;
  type: 'os' | 'venda' | 'parcela';
}

const fieldLabels: Record<string, string> = {
  id: 'ID',
  numero: 'Número',
  status: 'Status',
  situacao: 'Situação',
  data_entrada: 'Data de Entrada',
  previsao_entrega: 'Previsão de Entrega',
  data_previsao: 'Data Previsão',
  data_venda: 'Data da Venda',
  vencimento: 'Vencimento',
  data_vencimento: 'Data de Vencimento',
  valor: 'Valor',
  valor_total: 'Valor Total',
  total: 'Total',
  forma_pagamento: 'Forma de Pagamento',
  pagamento: 'Pagamento',
  cliente: 'Cliente',
  nome_cliente: 'Nome do Cliente',
  cpf_cliente: 'CPF do Cliente',
  telefone_cliente: 'Telefone do Cliente',
  observacoes: 'Observações',
  obs: 'Observações',
  documento: 'Documento',
  numero_documento: 'Número do Documento',
  numero_parcela: 'Número da Parcela',
  parcela: 'Parcela',
  boleto_url: 'Link do Boleto',
  link_boleto: 'Link do Boleto',
  pix_copia_cola: 'PIX Copia e Cola',
  pix: 'PIX',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
  descricao: 'Descrição',
  produtos: 'Produtos',
  itens: 'Itens',
  vendedor: 'Vendedor',
  atendente: 'Atendente',
  tipo: 'Tipo',
  tipo_os: 'Tipo de O.S.',
  laboratorio: 'Laboratório',
  receita: 'Receita',
  lente: 'Lente',
  armacao: 'Armação',
  desconto: 'Desconto',
  acrescimo: 'Acréscimo',
  entrada: 'Entrada',
  saldo: 'Saldo',
};

const ignoredFields = ['raw_data', 'cliente'];

const formatValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic">-</span>;
  }

  // Date fields
  if (key.includes('data') || key.includes('vencimento') || key.includes('previsao') || key.includes('created_at') || key.includes('updated_at')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
    } catch {
      return String(value);
    }
  }

  // Currency fields
  if (key.includes('valor') || key.includes('total') || key.includes('desconto') || key.includes('acrescimo') || key.includes('entrada') || key.includes('saldo')) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    }
  }

  // URL fields
  if (key.includes('url') || key.includes('link')) {
    return (
      <a 
        href={value} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1"
      >
        Abrir <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  // PIX field
  if (key.includes('pix')) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success('PIX copiado!');
        }}
        className="h-7 gap-1"
      >
        <Copy className="h-3 w-3" /> Copiar PIX
      </Button>
    );
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">Nenhum</span>;
    return (
      <div className="space-y-1">
        {value.map((item, i) => (
          <div key={i} className="text-sm bg-muted/50 p-2 rounded">
            {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
          </div>
        ))}
      </div>
    );
  }

  // Objects
  if (typeof value === 'object') {
    return (
      <div className="text-sm bg-muted/50 p-2 rounded">
        <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  // Boolean
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }

  return String(value);
};

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower === 'concluido' || statusLower === 'entregue' || statusLower === 'pago') {
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">{status}</Badge>;
  }
  if (statusLower === 'em_andamento' || statusLower === 'producao' || statusLower === 'pendente') {
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">{status}</Badge>;
  }
  if (statusLower === 'cancelado' || statusLower === 'vencido') {
    return <Badge variant="destructive">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

export const SsoticaDetailSheet = ({ open, onOpenChange, title, data, type }: SsoticaDetailSheetProps) => {
  if (!data) return null;

  const rawData = data.raw_data || data;
  
  // Separate main fields from raw_data extras
  const mainFields = Object.entries(data).filter(([key]) => !ignoredFields.includes(key));
  const extraFields = data.raw_data 
    ? Object.entries(data.raw_data).filter(([key]) => 
        !Object.keys(data).includes(key) && !ignoredFields.includes(key)
      )
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-xl">{title}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)] px-6 pb-6">
          {/* Cliente Info */}
          {(data.cliente?.nome || rawData?.cliente?.nome || rawData?.nome_cliente) && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium text-sm text-muted-foreground mb-2">Cliente</h3>
              <p className="font-medium">{data.cliente?.nome || rawData?.cliente?.nome || rawData?.nome_cliente}</p>
              {(data.cliente?.cpf || rawData?.cliente?.cpf || rawData?.cpf_cliente) && (
                <p className="text-sm text-muted-foreground">
                  CPF: {data.cliente?.cpf || rawData?.cliente?.cpf || rawData?.cpf_cliente}
                </p>
              )}
              {(data.cliente?.telefone || rawData?.cliente?.telefone || rawData?.telefone_cliente) && (
                <p className="text-sm text-muted-foreground">
                  Tel: {data.cliente?.telefone || rawData?.cliente?.telefone || rawData?.telefone_cliente}
                </p>
              )}
            </div>
          )}

          <Separator className="my-4" />

          {/* Main Fields */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">Informações Principais</h3>
            {mainFields.map(([key, value]) => {
              if (key === 'cliente') return null;
              return (
                <div key={key} className="flex justify-between items-start gap-4 py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground shrink-0">
                    {fieldLabels[key] || key}
                  </span>
                  <div className="text-right">
                    {key === 'status' || key === 'situacao' 
                      ? getStatusBadge(value as string)
                      : formatValue(key, value)
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extra Fields from raw_data */}
          {extraFields.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">Dados Adicionais</h3>
                {extraFields.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start gap-4 py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground shrink-0">
                      {fieldLabels[key] || key}
                    </span>
                    <div className="text-right max-w-[60%]">
                      {key === 'status' || key === 'situacao' 
                        ? getStatusBadge(value as string)
                        : formatValue(key, value)
                      }
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
