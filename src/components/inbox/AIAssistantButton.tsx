import { useState } from "react";
import { Sparkles, MessageSquare, FileText, Languages, Loader2, Wand2, PenLine, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface AIAssistantButtonProps {
  conversationId: string;
  onSuggestion: (text: string) => void;
  currentMessage?: string;
  disabled?: boolean;
}

type AIAction = 'suggest' | 'respond' | 'summarize' | 'translate' | 'rewrite';

const rewriteTones = [
  { id: 'formal', label: 'Formal', description: 'Tom profissional e corporativo', icon: '📄' },
  { id: 'friendly', label: 'Amigável', description: 'Tom casual e simpático', icon: '😊' },
  { id: 'welcoming', label: 'Acolhedora', description: 'Tom empático e caloroso', icon: '🤗' },
  { id: 'correction', label: 'Correção', description: 'Apenas ortografia e gramática', icon: '✏️' },
];

export const AIAssistantButton = ({ conversationId, onSuggestion, currentMessage, disabled }: AIAssistantButtonProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<AIAction | null>(null);
  const [result, setResult] = useState<{ action: AIAction; content: string } | null>(null);
  const [showRewriteOptions, setShowRewriteOptions] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState<string | null>(null);

  const handleAction = async (action: AIAction, tone?: string) => {
    if (action === 'rewrite') {
      if (!currentMessage?.trim()) {
        toast.error("Digite uma mensagem primeiro para reescrever");
        return;
      }
      setShowRewriteOptions(true);
      return;
    }

    setLoading(action);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('inbox-ai-assistant', {
        body: { conversationId, action }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResult({ action, content: data.result });

      // For certain actions, directly apply the result
      if (action === 'respond') {
        onSuggestion(data.result);
        toast.success("Resposta gerada!");
        setOpen(false);
        setResult(null);
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar com IA");
    } finally {
      setLoading(null);
    }
  };

  const handleRewrite = async (tone: string) => {
    if (!currentMessage?.trim()) {
      toast.error("Digite uma mensagem primeiro para reescrever");
      return;
    }

    setRewriteLoading(tone);

    try {
      const { data, error } = await supabase.functions.invoke('inbox-ai-assistant', {
        body: { conversationId, action: 'rewrite', tone, originalMessage: currentMessage }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResult({ action: 'rewrite', content: data.result });
      setShowRewriteOptions(false);
    } catch (error) {
      console.error('AI Rewrite error:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao reescrever mensagem");
    } finally {
      setRewriteLoading(null);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    // Extract the suggestion text (remove numbering)
    const cleanSuggestion = suggestion.replace(/^\d+\.\s*/, '').trim();
    onSuggestion(cleanSuggestion);
    setOpen(false);
    setResult(null);
    toast.success("Sugestão aplicada!");
  };

  const actions = [
    {
      id: 'rewrite' as AIAction,
      label: 'Reescrever mensagem',
      description: 'Reescrever com diferentes tons',
      icon: PenLine,
    },
    {
      id: 'suggest' as AIAction,
      label: 'Sugerir respostas',
      description: 'IA sugere 3 opções de resposta',
      icon: MessageSquare,
    },
    {
      id: 'respond' as AIAction,
      label: 'Gerar resposta',
      description: 'IA cria uma resposta completa',
      icon: Wand2,
    },
    {
      id: 'summarize' as AIAction,
      label: 'Resumir conversa',
      description: 'IA resume os pontos principais',
      icon: FileText,
    },
    {
      id: 'translate' as AIAction,
      label: 'Traduzir mensagem',
      description: 'Traduzir última mensagem',
      icon: Languages,
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-primary"
          disabled={disabled}
          title="Assistente de IA"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end" side="top">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Assistente de IA</p>
          </div>

          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {result.action === 'suggest' ? 'Sugestões' : 
                     result.action === 'summarize' ? 'Resumo' : 
                     result.action === 'translate' ? 'Tradução' :
                     result.action === 'rewrite' ? 'Mensagem reescrita' : 'Resultado'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setResult(null)}
                  >
                    Voltar
                  </Button>
                </div>

                {result.action === 'suggest' ? (
                  <div className="space-y-2">
                    {result.content.split('\n').filter(line => line.trim()).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left p-2 text-sm bg-muted/50 hover:bg-muted rounded-md transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{result.content}</p>
                    {(result.action === 'translate' || result.action === 'rewrite') && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => {
                          onSuggestion(result.content);
                          setOpen(false);
                          setResult(null);
                        }}
                      >
                        Usar este texto
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            ) : showRewriteOptions ? (
              <motion.div
                key="rewrite-options"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setShowRewriteOptions(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-xs font-medium text-muted-foreground">Escolha o tom</p>
                </div>
                {rewriteTones.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => handleRewrite(tone.id)}
                    disabled={rewriteLoading !== null}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                      {rewriteLoading === tone.id ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        tone.icon
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{tone.label}</p>
                      <p className="text-xs text-muted-foreground">{tone.description}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-1"
              >
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    disabled={loading !== null}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {loading === action.id ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : (
                        <action.icon className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
};
