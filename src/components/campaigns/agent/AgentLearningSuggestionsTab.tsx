import { useState } from "react";
import { useAgentLearningSuggestions, useLearningSuggestionMutations, LearningSuggestion } from "@/hooks/useAgentLearningSuggestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Check, X, Sparkles, Edit, MessageSquare, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentLearningSuggestionsTabProps {
  agentConfigId: string;
}

const categoryColors: Record<string, string> = {
  FAQ: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Produto: "bg-green-500/20 text-green-400 border-green-500/30",
  Preço: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Prazo: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Pagamento: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Suporte: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Objeção: "bg-red-500/20 text-red-400 border-red-500/30",
  Outro: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function AgentLearningSuggestionsTab({ agentConfigId }: AgentLearningSuggestionsTabProps) {
  const { data: suggestions, isLoading } = useAgentLearningSuggestions(agentConfigId);
  const { approveSuggestion, dismissSuggestion, analyzeConversations } = useLearningSuggestionMutations();
  
  const [activeTab, setActiveTab] = useState("pending");
  const [editDialog, setEditDialog] = useState<LearningSuggestion | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pendingSuggestions = suggestions?.filter(s => s.status === "pending") || [];
  const approvedSuggestions = suggestions?.filter(s => s.status === "approved") || [];
  const dismissedSuggestions = suggestions?.filter(s => s.status === "dismissed") || [];

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await analyzeConversations.mutateAsync({ agentConfigId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async (suggestion: LearningSuggestion) => {
    await approveSuggestion.mutateAsync({ suggestion });
  };

  const handleEditAndApprove = (suggestion: LearningSuggestion) => {
    setEditDialog(suggestion);
    setEditedTitle(suggestion.suggested_title || suggestion.question.slice(0, 50));
    setEditedContent(`**Pergunta:** ${suggestion.question}\n\n**Resposta:** ${suggestion.answer}`);
  };

  const handleConfirmEdit = async () => {
    if (!editDialog) return;
    await approveSuggestion.mutateAsync({
      suggestion: editDialog,
      editedTitle,
      editedContent,
    });
    setEditDialog(null);
  };

  const handleDismiss = async (suggestion: LearningSuggestion) => {
    await dismissSuggestion.mutateAsync({
      suggestionId: suggestion.id,
      agentConfigId: suggestion.agent_config_id,
    });
  };

  const getConfidenceColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 0.9) return "text-green-400";
    if (score >= 0.7) return "text-yellow-400";
    return "text-orange-400";
  };

  const renderSuggestionCard = (suggestion: LearningSuggestion, showActions = true) => (
    <Card key={suggestion.id} className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={categoryColors[suggestion.category || "Outro"]}>
              {suggestion.category || "Outro"}
            </Badge>
            <span className={`text-xs ${getConfidenceColor(suggestion.confidence_score)}`}>
              {suggestion.confidence_score ? `${Math.round(suggestion.confidence_score * 100)}% confiança` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(suggestion.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        </div>
        {suggestion.suggested_title && (
          <CardTitle className="text-sm font-medium mt-2">{suggestion.suggested_title}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Pergunta do cliente:</p>
          <p className="text-sm bg-muted/30 p-2 rounded-md">{suggestion.question}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Resposta dada:</p>
          <p className="text-sm bg-primary/10 p-2 rounded-md">{suggestion.answer}</p>
        </div>
        
        {showActions && suggestion.status === "pending" && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => handleApprove(suggestion)}
              disabled={approveSuggestion.isPending}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditAndApprove(suggestion)}
              disabled={approveSuggestion.isPending}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDismiss(suggestion)}
              disabled={dismissSuggestion.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {suggestion.status === "approved" && (
          <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
            <Check className="h-3 w-3 mr-1" />
            Aprovado
          </Badge>
        )}

        {suggestion.status === "dismissed" && (
          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
            <X className="h-3 w-3 mr-1" />
            Ignorado
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Aprendizado Contínuo</h3>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant="outline"
          size="sm"
        >
          {isAnalyzing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Analisar Conversas
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        O sistema analisa conversas recentes e sugere novos conhecimentos para o agente.
        Revise as sugestões e adicione à base de conhecimento.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pendentes
            {pendingSuggestions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingSuggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex-1">
            Aprovadas ({approvedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="dismissed" className="flex-1">
            Ignoradas ({dismissedSuggestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingSuggestions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <CardTitle className="text-lg mb-2">Nenhuma sugestão pendente</CardTitle>
                <CardDescription>
                  Clique em "Analisar Conversas" para encontrar novos padrões nas conversas do agente.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingSuggestions.map(s => renderSuggestionCard(s))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {approvedSuggestions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Check className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <CardTitle className="text-lg mb-2">Nenhuma sugestão aprovada</CardTitle>
                <CardDescription>
                  Sugestões aprovadas aparecerão aqui.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {approvedSuggestions.map(s => renderSuggestionCard(s, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dismissed" className="mt-4">
          {dismissedSuggestions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <X className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <CardTitle className="text-lg mb-2">Nenhuma sugestão ignorada</CardTitle>
                <CardDescription>
                  Sugestões ignoradas aparecerão aqui.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {dismissedSuggestions.map(s => renderSuggestionCard(s, false))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar e Adicionar</DialogTitle>
            <DialogDescription>
              Edite o título e conteúdo antes de adicionar à base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Título do conhecimento"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Conteúdo do conhecimento"
                rows={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit} disabled={approveSuggestion.isPending}>
              <Check className="h-4 w-4 mr-2" />
              Adicionar à Base
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
