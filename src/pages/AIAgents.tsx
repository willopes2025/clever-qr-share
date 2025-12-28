import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Bot, Loader2, Search, Sparkles } from "lucide-react";
import { useAllAgentConfigs } from "@/hooks/useAIAgentConfig";
import { AIAgentCard } from "@/components/ai-agents/AIAgentCard";
import { AIAgentFormDialog } from "@/components/ai-agents/AIAgentFormDialog";
import { AIAgentTemplateSelector } from "@/components/ai-agents/AIAgentTemplateSelector";
import { AIAgentTemplate } from "@/data/ai-agent-templates";

const AIAgents = () => {
  const { data: agents, isLoading: isLoadingAgents, refetch } = useAllAgentConfigs();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AIAgentTemplate | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  const handleSelectTemplate = (template: AIAgentTemplate | null) => {
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);
    setIsFormDialogOpen(true);
  };

  const handleEditAgent = (agentId: string) => {
    setEditingAgentId(agentId);
    setSelectedTemplate(null);
    setIsFormDialogOpen(true);
  };

  const handleCloseFormDialog = (open: boolean) => {
    setIsFormDialogOpen(open);
    if (!open) {
      setSelectedTemplate(null);
      setEditingAgentId(null);
      refetch();
    }
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
      />

      {/* Agent Form Dialog */}
      <AIAgentFormDialog
        open={isFormDialogOpen}
        onOpenChange={handleCloseFormDialog}
        template={selectedTemplate}
        editingAgentId={editingAgentId}
      />
    </DashboardLayout>
  );
};

export default AIAgents;
