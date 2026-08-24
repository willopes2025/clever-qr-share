import { useState } from "react";
import { Cog, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useGestaoParts, useGestaoPartsLead } from "@/hooks/useGestaoParts";
import { extractRows } from "@/components/gestao-parts/GestaoPartsTable";

interface GestaoPartsDealSectionProps {
  contactPhone?: string;
  contactCustomFields?: Record<string, unknown>;
  dealCustomFields?: Record<string, unknown>;
}

const DOC_KEYS = ['cpf', 'cnpj', 'documento', 'cpf_cnpj', 'cpfcnpj'];

function findDocument(...sources: Array<Record<string, unknown> | undefined>): string {
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
      if (DOC_KEYS.includes(normalized) && value) {
        const digits = String(value).replace(/\D/g, '');
        if (digits.length === 11 || digits.length === 14) return digits;
      }
    }
  }
  return '';
}

export const GestaoPartsDealSection = ({
  contactPhone,
  contactCustomFields,
  dealCustomFields,
}: GestaoPartsDealSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { hasGestaoParts } = useGestaoParts();

  const documento = findDocument(dealCustomFields, contactCustomFields);
  const { data, isFetching, error, refetch } = useGestaoPartsLead(
    contactPhone,
    documento,
    hasGestaoParts && isOpen,
  );

  if (!hasGestaoParts) return null;

  const pessoa = (data?.pessoa || null) as Record<string, unknown> | null;
  const encontrado = pessoa && Number(pessoa.codstatus ?? 0) === 1;
  const pedidos = extractRows(data?.pedidos).filter((p) => Object.keys(p).length > 0);
  const financeiro = extractRows(data?.financeiro).filter((p) => Object.keys(p).length > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between h-8 px-2">
          <div className="flex items-center gap-2">
            <Cog className="h-3.5 w-3.5" />
            <span className="text-xs">Gestão Parts</span>
          </div>
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-2 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {documento ? `Doc: ${documento}` : contactPhone ? `Tel: ${contactPhone}` : 'Sem telefone/documento'}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          </Button>
        </div>

        {isFetching && (
          <p className="text-[11px] text-muted-foreground">Consultando ERP...</p>
        )}

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="break-all">{(error as Error).message}</span>
          </div>
        )}

        {!isFetching && !error && data && (
          <div className="space-y-3">
            <div className="rounded-md border p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium">Cadastro no ERP</span>
                <Badge variant={encontrado ? "default" : "secondary"} className="text-[10px]">
                  {encontrado ? "Encontrado" : "Não localizado"}
                </Badge>
              </div>
              {encontrado && (
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  {pessoa?.codigo ? <div>Código: {String(pessoa.codigo)}</div> : null}
                  {pessoa?.nome ? <div>Nome: {String(pessoa.nome)}</div> : null}
                  {pessoa?.fantasia ? <div>Fantasia: {String(pessoa.fantasia)}</div> : null}
                </div>
              )}
            </div>

            {pedidos.length > 0 && (
              <div className="rounded-md border p-2 space-y-1">
                <span className="text-[11px] font-medium">Pedidos ({pedidos.length})</span>
                <div className="space-y-1">
                  {pedidos.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[140px]">
                        {String(p.numpedido ?? p.requisicao ?? p.pedido ?? p.numero ?? `#${i + 1}`)}
                      </span>
                      <span>{String(p.status ?? p.situacao ?? '-')}</span>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {financeiro.length > 0 && (
              <div className="rounded-md border p-2 space-y-1">
                <span className="text-[11px] font-medium">Contas a receber ({financeiro.length})</span>
                <div className="space-y-1">
                  {financeiro.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[140px]">
                        {String(f.numeroduplicata ?? f.documento ?? f.planilha ?? `#${i + 1}`)}
                      </span>
                      <span>
                        {f.valor !== undefined
                          ? `R$ ${Number(f.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : String(f.vencimento ?? '-')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
