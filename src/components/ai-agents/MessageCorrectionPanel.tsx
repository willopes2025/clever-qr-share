import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Check, RefreshCw, Lightbulb, AlertCircle, FileText, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TargetSection = 
  | 'personality_prompt' 
  | 'behavior_rules' 
  | 'greeting_message' 
  | 'fallback_message' 
  | 'goodbye_message' 
  | 'knowledge';

export interface CorrectionSuggestion {
  targetSection: TargetSection;
  targetSectionLabel: string;
  currentContent: string;
  suggestedEdit: {
    type: 'append' | 'replace' | 'prepend';
    newContent: string;
    previewFull: string;
  };
  confidence: number;
  reasoning: string;
}

interface MessageCorrectionPanelProps {
  userQuestion: string;
  agentResponse: string;
  agentId: string;
  agentName: string;
  onApprove: (suggestion: CorrectionSuggestion) => void;
  onCancel: () => void;
}

type PanelMode = 'input' | 'analyzing' | 'review' | 'refining';

const SECTION_ICONS: Record<TargetSection, string> = {
  personality_prompt: '🎭',
  behavior_rules: '📋',
  greeting_message: '👋',
  fallback_message: '🤷',
  goodbye_message: '👋',
  knowledge: '📚',
};

const EDIT_TYPE_LABELS: Record<string, string> = {
  append: 'Será adicionado ao final',
  prepend: 'Será adicionado no início',
  replace: 'Substituirá o conteúdo atual',
};

export const MessageCorrectionPanel = ({
  userQuestion,
  agentResponse,
  agentId,
  agentName,
  onApprove,
  onCancel,
}: MessageCorrectionPanelProps) => {
  const [mode, setMode] = useState<PanelMode>('input');
  const [correctionInput, setCorrectionInput] = useState("");
  const [suggestion, setSuggestion] = useState<CorrectionSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!correctionInput.trim()) {
      toast.error("Digite a correção antes de analisar");
      return;
    }

    setIsLoading(true);
    setMode('analyzing');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-agent-correction', {
        body: {
          userQuestion,
          agentResponse,
          userCorrection: correctionInput.trim(),
          agentName,
          agentId,
        },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.suggestion) {
        setSuggestion(data.suggestion);
        setMode('review');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      console.error('Error analyzing correction:', err);
      setError(err.message || 'Erro ao analisar correção');
      setMode('input');
      toast.error(err.message || 'Erro ao analisar correção');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = () => {
    setMode('refining');
  };

  const handleReanalyze = () => {
    setMode('input');
    setSuggestion(null);
  };

  const handleApprove = () => {
    if (suggestion) {
      onApprove(suggestion);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const renderDiff = () => {
    if (!suggestion) return null;
    
    const { currentContent, suggestedEdit } = suggestion;
    const { type, newContent } = suggestedEdit;

    if (suggestion.targetSection === 'knowledge') {
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Novo conhecimento a ser adicionado:</p>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-3">
            <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
              + {newContent}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Current Content */}
        {currentContent && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Conteúdo Atual:</p>
            <ScrollArea className="max-h-[120px]">
              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">
                {currentContent || <span className="italic text-muted-foreground">(vazio)</span>}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Arrow */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
          <span className="text-xs">{EDIT_TYPE_LABELS[type]}</span>
        </div>

        {/* New Content */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Alteração:</p>
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-3">
            <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
              + {newContent}
            </p>
          </div>
        </div>

        {/* Preview Full (only if there's existing content) */}
        {currentContent && type !== 'replace' && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Como ficará:</p>
            <ScrollArea className="max-h-[150px]">
              <div className="bg-background border rounded-md p-3 text-sm whitespace-pre-wrap">
                {suggestedEdit.previewFull}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-3 p-4 bg-background rounded-lg border shadow-sm space-y-4 animate-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="h-4 w-4 text-primary" />
          Corrigir Resposta
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Context */}
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Pergunta:</span>
          <p className="text-foreground truncate">&ldquo;{userQuestion}&rdquo;</p>
        </div>
        <div>
          <span className="text-muted-foreground">Resposta a corrigir:</span>
          <p className="text-foreground truncate">&ldquo;{agentResponse.substring(0, 100)}...&rdquo;</p>
        </div>
      </div>

      {/* Input Mode */}
      {(mode === 'input' || mode === 'refining') && (
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              {mode === 'refining' ? 'Refine a correção:' : 'Como deveria responder:'}
            </label>
            <Textarea
              placeholder="Digite aqui a resposta correta que o agente deveria dar..."
              value={correctionInput}
              onChange={(e) => setCorrectionInput(e.target.value)}
              className="min-h-[80px] resize-none"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAnalyze} disabled={!correctionInput.trim() || isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                'Analisar'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Analyzing Mode */}
      {mode === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando correção e identificando seção...</p>
        </div>
      )}

      {/* Review Mode */}
      {mode === 'review' && suggestion && (
        <div className="space-y-4">
          {/* Target Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                <span className="mr-1">{SECTION_ICONS[suggestion.targetSection]}</span>
                {suggestion.targetSectionLabel}
              </Badge>
            </div>
            <Badge 
              variant="outline" 
              className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
            >
              {suggestion.confidence}% confiança
            </Badge>
          </div>

          {/* Diff View */}
          {renderDiff()}

          {/* Reasoning */}
          <div className="bg-muted/30 rounded-md p-3 border-l-2 border-primary/50">
            <p className="text-xs text-muted-foreground">
              💡 {suggestion.reasoning}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReanalyze}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refazer
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefine}>
                Refinar
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-2" />
                Aprovar Edição
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
