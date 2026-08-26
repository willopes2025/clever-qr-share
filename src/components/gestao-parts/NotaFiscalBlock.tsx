import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink, Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { text } from "./utils";

interface NotaFiscalBlockProps {
  pedido: Record<string, unknown>;
}

/** Chave da NF-e formatada em grupos de 4 dígitos */
export const formatChaveNfe = (chave: unknown): string =>
  String(chave ?? "")
    .replace(/\D/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();

const SEFAZ_URL = "https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=";

/**
 * Bloco de nota fiscal do pedido: chave, consulta na SEFAZ e tentativa de
 * download do DANFE/XML diretamente do ERP (quando a rota estiver disponível).
 */
export const NotaFiscalBlock = ({ pedido }: NotaFiscalBlockProps) => {
  const [loading, setLoading] = useState<"pdf" | "xml" | null>(null);

  const chave = String(pedido.nfe_chave ?? "").replace(/\D/g, "");
  const numero = text(pedido.nfe_numero);
  const serie = text(pedido.nfe_serie);

  const copiar = async () => {
    await navigator.clipboard.writeText(chave);
    toast.success("Chave da NF-e copiada");
  };

  const baixar = async (formato: "pdf" | "xml") => {
    if (chave.length !== 44) return;
    setLoading(formato);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-parts-api", {
        body: { action: "nfe_documento", params: { chave, formato } },
      });
      if (error) throw error;
      if (!data?.available) {
        toast.error(data?.message || "DANFE não disponível no ERP. Use a consulta na SEFAZ.");
        return;
      }

      const isBase64 = String(data.kind).endsWith("base64");
      const blob = isBase64
        ? new Blob(
            [Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0))],
            { type: formato === "pdf" ? "application/pdf" : "application/xml" },
          )
        : new Blob([data.content], { type: "application/xml" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfe-${chave}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao buscar a nota fiscal");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ReceiptText className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">
          Nota fiscal {numero ? `nº ${numero}` : ""} {serie ? `· série ${serie}` : ""}
        </p>
      </div>

      {chave.length === 44 ? (
        <>
          <p className="text-xs font-mono break-all text-muted-foreground">{formatChaveNfe(chave)}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copiar}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar chave
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              <a href={SEFAZ_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Consultar na SEFAZ
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => baixar("pdf")}
              disabled={loading !== null}
            >
              {loading === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              DANFE (PDF)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => baixar("xml")}
              disabled={loading !== null}
            >
              {loading === "xml" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              XML
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Na SEFAZ, cole a chave no campo de consulta para ver a nota completa.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Pedido faturado sem chave de NF-e no retorno do ERP.</p>
      )}
    </div>
  );
};
