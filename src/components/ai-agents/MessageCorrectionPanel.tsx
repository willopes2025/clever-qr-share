import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Check, RefreshCw, Lightbulb, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CorrectionSuggestion {
  title: string;
  category: string;
  content: string;
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

  return (
    <div className="mt-3 p-4 bg-muted/50 rounded-lg border space-y-4 animate-in slide-in-from-top-2">
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAnalyze} disabled={!correctionInput.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                'Analisar Correção'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Analyzing Mode */}
      {mode === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando correção com IA...</p>
        </div>
      )}

      {/* Review Mode */}
      {mode === 'review' && suggestion && (
        <div className="space-y-4">
          {/* Suggestion Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Sugestão de Conhecimento
            </h4>
            <Badge 
              variant="outline" 
              className={cn("text-xs", getConfidenceColor(suggestion.confidence))}
            >
              {suggestion.confidence}% confiança
            </Badge>
          </div>

          {/* Suggestion Content */}
          <div className="bg-background rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{suggestion.title}</span>
              <Badge variant="secondary" className="text-xs">
                {suggestion.category}
              </Badge>
            </div>
            
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {suggestion.content}
            </p>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground italic">
                💡 {suggestion.reasoning}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={handleReanalyze}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refazer
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefine}>
                Refinar
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-2" />
                Adicionar ao Conhecimento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
