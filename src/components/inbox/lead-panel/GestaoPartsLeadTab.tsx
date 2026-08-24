import { useState } from "react";
import { Cog, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useGestaoParts } from "@/hooks/useGestaoParts";
import { useGestaoPartsLeadData } from "@/hooks/useGestaoPartsLeadData";
import { PedidosTable, PedidoRow } from "@/components/gestao-parts/PedidosTable";
import { brDate, money, num, pick, text } from "@/components/gestao-parts/utils";
import { formatDateTime } from "@/lib/timezone";

interface GestaoPartsLeadTabProps {
  contactId: string;
  contactPhone?: string | null;
  contactCustomFields?: Record<string, unknown> | null;
  dealCustomFields?: Record<string, unknown> | null;
  dealId?: string | null;
}

const DOC_KEYS = ["cpf", "cnpj", "documento", "cpfcnpj"];

const findDocument = (...sources: Array<Record<string, unknown> | null | undefined>): string => {
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
      if (DOC_KEYS.includes(normalized) && value) {
        const digits = String(value).replace(/\D/g, "");
        if (digits.length === 11 || digits.length === 14) return digits;
      }
    }
  }
  return "";
};

export const GestaoPartsLeadTab = ({
  contactId,
  contactPhone,
  contactCustomFields,
  dealCustomFields,
  dealId,
}: GestaoPartsLeadTabProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { hasGestaoParts } = useGestaoParts();
  const { data, isLoading, sync } = useGestaoPartsLeadData(contactId);

  if (!hasGestaoParts) return null;

  const documento = findDocument(dealCustomFields, contactCustomFields);
  const pedidos = (data?.pedidos ?? []) as PedidoRow[];
  const financeiro = data?.financeiro ?? [];
  const emAberto = financeiro.reduce((sum, f) => sum + (num(pick(f, ["valor", "valorsaldo", "saldo"])) ?? 0), 0);

  const handleSync = () =>
    sync.mutate({ telefone: contactPhone || "", documento, dealId });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="px-3 py-2 border-t border-border/50">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between h-9 px-2 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Cog className="h-4 w-4 text-muted-foreground" />
            <span>Gestão Parts</span>
            {data?.pedidos_count ? (
              <Badge variant="secondary" className="text-[10px]">{data.pedidos_count}</Badge>
            ) : null}
          </div>
          <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground truncate">
            {documento ? `Doc: ${documento}` : contactPhone ? `Tel: ${contactPhone}` : "Sem telefone/documento"}
            {data?.last_synced_at ? ` · ${formatDateTime(new Date(data.last_synced_at))}` : ""}
          </span>
          <Button size="sm" className="h-7 px-2 shrink-0" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5 mr-1.5" />
            )}
            {data ? "Atualizar" : "Buscar no ERP"}
          </Button>
        </div>

        {isLoading && <p className="text-[11px] text-muted-foreground">Carregando dados salvos...</p>}

        {!isLoading && !data && (
          <p className="text-[11px] text-muted-foreground">
            Nenhuma consulta feita ainda. Clique em "Buscar no ERP" para trazer o cadastro, pedidos e financeiro deste lead.
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-2">
                <p className="text-[10px] text-muted-foreground">Cliente no ERP</p>
                <p className="text-xs font-medium truncate">
                  {data.erp_nome ? data.erp_nome : "Não localizado"}
                </p>
                {data.erp_codigo ? (
                  <p className="text-[10px] text-muted-foreground">Cód. {data.erp_codigo}</p>
                ) : null}
              </div>
              <div className="rounded-md border p-2">
                <p className="text-[10px] text-muted-foreground">Total comprado</p>
                <p className="text-xs font-semibold">{money(data.pedidos_total)}</p>
                <p className="text-[10px] text-muted-foreground">{data.pedidos_count} pedido(s)</p>
              </div>
            </div>

            {financeiro.length > 0 && (
              <div className="rounded-md border divide-y">
                <div className="flex items-center justify-between p-2">
                  <span className="text-[11px] font-medium">Contas a receber ({financeiro.length})</span>
                  <span className="text-[11px] font-semibold">{money(emAberto)}</span>
                </div>
                {financeiro.slice(0, 8).map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 text-[11px]">
                    <span className="truncate max-w-[55%]">
                      {text(pick(f, ["numeroduplicata", "documento", "planilha"]))}
                    </span>
                    <span className="text-muted-foreground">
                      {brDate(pick(f, ["vencimento", "dtvencimento"]))} · {money(pick(f, ["valor", "valorsaldo"]))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] font-medium mb-1">Pedidos</p>
              <PedidosTable rows={pedidos} emptyMessage="Nenhum pedido localizado no ERP" />
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
