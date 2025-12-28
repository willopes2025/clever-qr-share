import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Bot, Building2, Save, Loader2, Search, Sparkles } from "lucide-react";
import { useAllAgentConfigs } from "@/hooks/useAIAgentConfig";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AIAgentCard } from "@/components/ai-agents/AIAgentCard";
import { AIAgentFormDialog } from "@/components/ai-agents/AIAgentFormDialog";
import { AIAgentTemplateSelector } from "@/components/ai-agents/AIAgentTemplateSelector";
import { AIAgentTemplate } from "@/data/ai-agent-templates";

const AIAgents = () => {
  const queryClient = useQueryClient();
  const { data: agents, isLoading: isLoadingAgents, refetch } = useAllAgentConfigs();
  const { organization } = useOrganization();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AIAgentTemplate | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [personalizeWithCompany, setPersonalizeWithCompany] = useState(true);
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  // Load company context when organization is available
  useEffect(() => {
    if (organization?.id) {
      supabase
        .from("organizations")
        .select("company_context")
        .eq("id", organization.id)
        .single()
        .then(({ data }) => {
          if (data?.company_context) {
            setCompanyContext(data.company_context);
          }
        });
    }
  }, [organization?.id]);

  const handleSaveCompanyContext = async () => {
    if (!organization?.id) {
      toast.error("Você precisa ter uma organização para salvar o contexto");
      return;
    }

    setIsSavingContext(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ company_context: companyContext })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("Contexto da empresa salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleSelectTemplate = async (template: AIAgentTemplate | null) => {
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);

    if (template && personalizeWithCompany && companyContext) {
      setIsPersonalizing(true);
      try {
        const { data, error } = await supabase.functions.invoke("personalize-agent-template", {
          body: {
            template,
            companyContext,
          },
        });

        if (error) throw error;

        if (data?.personalizedTemplate) {
          setSelectedTemplate(data.personalizedTemplate);
        }
      } catch (error: any) {
        console.error("Erro ao personalizar template:", error);
        toast.error("Não foi possível personalizar o template. Usando versão padrão.");
      } finally {
        setIsPersonalizing(false);
      }
    }

    setIsFormDialogOpen(true);
  };

  const handleEditAgent = (agentId: string) => {
    setEditingAgentId(agentId);
    setSelectedTemplate(null);
    setIsFormDialogOpen(true);
  };

  const handleCloseFormDialog = () => {
    setIsFormDialogOpen(false);
    setSelectedTemplate(null);
    setEditingAgentId(null);
    refetch();
  };

  const filteredAgents = agents?.filter(agent => 
    agent.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              Central de Agentes de IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os seus agentes de IA em um só lugar
            </p>
          </div>
          <Button onClick={() => setIsTemplateSelectorOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Novo Agente
          </Button>
        </div>

        {/* Company Context Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Sobre sua Empresa
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Descreva sua empresa para personalizar automaticamente os agentes de IA
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Ex: Somos a XYZ Tech, especializada em soluções SaaS para pequenas empresas. Nosso principal produto é o CRM Vendas+ que custa a partir de R$ 99/mês. Atendemos principalmente empresas de varejo e serviços..."
              value={companyContext}
              onChange={(e) => setCompanyContext(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {companyContext.length} caracteres
              </p>
              <Button 
                onClick={handleSaveCompanyContext} 
                disabled={isSavingContext}
                size="sm"
                className="gap-2"
              >
                {isSavingContext ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agents Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-semibold">Seus Agentes</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAgents && filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent) => (
                <AIAgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() => handleEditAgent(agent.id)}
                  onRefresh={refetch}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhum agente criado ainda</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Crie seu primeiro agente de IA usando um de nossos templates prontos ou comece do zero.
                </p>
                <Button onClick={() => setIsTemplateSelectorOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Agente
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Template Selector Dialog */}
      <AIAgentTemplateSelector
        open={isTemplateSelectorOpen}
        onOpenChange={setIsTemplateSelectorOpen}
        onSelectTemplate={handleSelectTemplate}
        personalizeWithCompany={personalizeWithCompany}
        setPersonalizeWithCompany={setPersonalizeWithCompany}
        hasCompanyContext={!!companyContext}
      />

      {/* Agent Form Dialog */}
      <AIAgentFormDialog
        open={isFormDialogOpen}
        onOpenChange={handleCloseFormDialog}
        template={selectedTemplate}
        editingAgentId={editingAgentId}
        isPersonalizing={isPersonalizing}
      />
    </DashboardLayout>
  );
};

export default AIAgents;
