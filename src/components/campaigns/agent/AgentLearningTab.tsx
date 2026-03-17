import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAgentLearningSuggestions,
  useLearningSuggestionMutations,
  LearningSuggestion,
} from "@/hooks/useAgentLearningSuggestions";
import {
  Loader2,
  Search,
  Check,
  X,
  GraduationCap,
  Sparkles,
  Edit2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AgentLearningTabProps {
  agentConfigId: string | null;
}

const categoryColors: Record<string, string> = {
  FAQ: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  Produto: "bg-green-500/10 text-green-700 dark:text-green-400",
  Preço: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Prazo: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  Pagamento: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  Suporte: "bg-red-500/10 text-red-700 dark:text-red-400",
  Objeção: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
  Outro: "bg-muted text-muted-foreground",
};

export const AgentLearningTab = ({ agentConfigId }: AgentLearningTabProps) => {
  const [period, setPeriod] = useState("last_7_days");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: suggestions = [], isLoading } = useAgentLearningSuggestions(agentConfigId);
  const { approveSuggestion, dismissSuggestion, analyzeConversations } = useLearningSuggestionMutations();

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const reviewedSuggestions = suggestions.filter((s) => s.status !== "pending");

  const handleAnalyze = () => {
    if (!agentConfigId) return;
    const periodMap: Record<string, string> = {
      yesterday: "yesterday",
      last_7_days: "last_7_days",
      last_30_days: "last_30_days",
    };
    analyzeConversations.mutate({ agentConfigId, date: periodMap[period] || period } as any);
  };

  const handleApprove = (suggestion: LearningSuggestion) => {
    if (editingId === suggestion.id) {
      approveSuggestion.mutate({
        suggestion,
        editedTitle: editTitle || undefined,
        editedContent: editContent || undefined,
      });
      setEditingId(null);
    } else {
      approveSuggestion.mutate({ suggestion });
    }
  };

  const handleStartEdit = (suggestion: LearningSuggestion) => {
    setEditingId(suggestion.id);
    setEditTitle(suggestion.suggested_title || suggestion.question.slice(0, 50));
    setEditContent(`**Pergunta:** ${suggestion.question}\n\n**Resposta:** ${suggestion.answer}`);
  };

  const handleDismiss = (suggestion: LearningSuggestion) => {
    if (!agentConfigId) return;
    dismissSuggestion.mutate({
      suggestionId: suggestion.id,
      agentConfigId,
    });
  };

  if (!agentConfigId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Salve o agente primeiro para usar o aprendizado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with analyze button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={analyzeConversations.isPending}
          size="sm"
        >
          {analyzeConversations.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Analisar Conversas
        </Button>
      </div>

      {/* Pending suggestions */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pendingSuggestions.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão pendente. Clique em "Analisar Conversas" para extrair FAQ das conversas.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-2">
            {pendingSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isExpanded={expandedId === suggestion.id}
                isEditing={editingId === suggestion.id}
                editTitle={editTitle}
                editContent={editContent}
                onToggleExpand={() =>
                  setExpandedId(expandedId === suggestion.id ? null : suggestion.id)
                }
                onStartEdit={() => handleStartEdit(suggestion)}
                onEditTitleChange={setEditTitle}
                onEditContentChange={setEditContent}
                onApprove={() => handleApprove(suggestion)}
                onDismiss={() => handleDismiss(suggestion)}
                onCancelEdit={() => setEditingId(null)}
                isApproving={approveSuggestion.isPending}
                isDismissing={dismissSuggestion.isPending}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Reviewed count */}
      {reviewedSuggestions.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          {reviewedSuggestions.filter((s) => s.status === "approved").length} aprovadas ·{" "}
          {reviewedSuggestions.filter((s) => s.status === "dismissed").length} ignoradas
        </p>
      )}
    </div>
  );
};

interface SuggestionCardProps {
  suggestion: LearningSuggestion;
  isExpanded: boolean;
  isEditing: boolean;
  editTitle: string;
  editContent: string;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onEditTitleChange: (v: string) => void;
  onEditContentChange: (v: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onCancelEdit: () => void;
  isApproving: boolean;
  isDismissing: boolean;
}

const SuggestionCard = ({
  suggestion,
  isExpanded,
  isEditing,
  editTitle,
  editContent,
  onToggleExpand,
  onStartEdit,
  onEditTitleChange,
  onEditContentChange,
  onApprove,
  onDismiss,
  onCancelEdit,
  isApproving,
  isDismissing,
}: SuggestionCardProps) => {
  const categoryClass = categoryColors[suggestion.category || "Outro"] || categoryColors.Outro;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={categoryClass}>
              {suggestion.category || "Outro"}
            </Badge>
            {suggestion.confidence_score && (
              <span className="text-xs text-muted-foreground">
                {Math.round(suggestion.confidence_score * 100)}% confiança
              </span>
            )}
          </div>
          <button
            onClick={onToggleExpand}
            className="text-left mt-1 w-full"
          >
            <p className="text-sm font-medium leading-snug">
              <MessageSquare className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
              {suggestion.question}
            </p>
          </button>
        </div>
        <button onClick={onToggleExpand} className="p-1 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t">
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => onEditTitleChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => onEditContentChange(e.target.value)}
                  className="mt-1 min-h-[100px]"
                />
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded p-2.5 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Resposta:</p>
              <p>{suggestion.answer}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 justify-end">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Salvar e Aprovar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={onDismiss} disabled={isDismissing}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Ignorar
                </Button>
                <Button size="sm" variant="outline" onClick={onStartEdit}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                  )}
                  Aprovar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
