import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileType, FileCode, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AgentExportData,
  exportAgentAsJSON,
  exportAgentAsPDF,
  exportAgentAsWord,
} from "@/lib/ai-agent-export";

interface AIAgentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: {
    id: string;
    agent_name: string;
  };
}

export const AIAgentExportDialog = ({
  open,
  onOpenChange,
  agent,
}: AIAgentExportDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const fetchExportData = async (): Promise<AgentExportData | null> => {
    try {
      // Fetch agent with all details
      const { data: agentData, error: agentError } = await supabase
        .from("ai_agent_configs")
        .select("*")
        .eq("id", agent.id)
        .single();

      if (agentError) throw agentError;

      // Fetch related data in parallel
      const [knowledgeResult, variablesResult, stagesResult, integrationsResult] =
        await Promise.all([
          supabase
            .from("ai_agent_knowledge_items")
            .select("id, title, source_type, content, website_url, file_name")
            .eq("agent_config_id", agent.id),
          supabase
            .from("ai_agent_variables")
            .select("id, variable_key, variable_value, variable_description")
            .eq("agent_config_id", agent.id),
          supabase
            .from("ai_agent_stages")
            .select("id, stage_name, stage_prompt, order_index, condition_type, is_final")
            .eq("agent_config_id", agent.id)
            .order("order_index"),
          supabase
            .from("ai_agent_integrations")
            .select("id, name, integration_type, is_active, webhook_target_url, api_base_url")
            .eq("agent_config_id", agent.id),
        ]);

      return {
        agent: agentData,
        knowledgeItems: knowledgeResult.data || [],
        variables: variablesResult.data || [],
        stages: stagesResult.data || [],
        integrations: integrationsResult.data || [],
      };
    } catch (error: any) {
      console.error("Error fetching export data:", error);
      toast.error("Erro ao buscar dados do agente: " + error.message);
      return null;
    }
  };

  const handleExport = async (format: "json" | "pdf" | "word") => {
    setIsLoading(true);
    setExportingFormat(format);

    try {
      const data = await fetchExportData();
      if (!data) return;

      switch (format) {
        case "json":
          exportAgentAsJSON(data);
          break;
        case "pdf":
          exportAgentAsPDF(data);
          break;
        case "word":
          exportAgentAsWord(data);
          break;
      }

      toast.success("Exportação concluída com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar: " + error.message);
    } finally {
      setIsLoading(false);
      setExportingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Agente</DialogTitle>
          <DialogDescription>
            Exportar todas as configurações do agente "{agent.agent_name}" em um dos formatos disponíveis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleExport("json")}
            disabled={isLoading}
          >
            {exportingFormat === "json" ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <FileCode className="h-5 w-5 mr-3 text-blue-500" />
            )}
            <div className="text-left">
              <div className="font-medium">JSON (TXT)</div>
              <div className="text-xs text-muted-foreground">
                Formato estruturado para backup ou importação
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleExport("pdf")}
            disabled={isLoading}
          >
            {exportingFormat === "pdf" ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <FileType className="h-5 w-5 mr-3 text-red-500" />
            )}
            <div className="text-left">
              <div className="font-medium">PDF</div>
              <div className="text-xs text-muted-foreground">
                Documento formatado para visualização e impressão
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleExport("word")}
            disabled={isLoading}
          >
            {exportingFormat === "word" ? (
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
            ) : (
              <FileText className="h-5 w-5 mr-3 text-blue-600" />
            )}
            <div className="text-left">
              <div className="font-medium">Word (DOC)</div>
              <div className="text-xs text-muted-foreground">
                Documento editável para documentação
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
