import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  User, 
  Send, 
  RotateCcw, 
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Node, Edge } from '@xyflow/react';

interface ChatMessage {
  id: string;
  role: 'bot' | 'user' | 'system';
  content: string;
  options?: string[];
  nodeId?: string;
  timestamp: Date;
}

interface ChatbotTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowName: string;
  nodes: Node[];
  edges: Edge[];
  onHighlightNode?: (nodeId: string | null) => void;
}

export const ChatbotTestDialog = ({
  open,
  onOpenChange,
  flowName,
  nodes,
  edges,
  onHighlightNode,
}: ChatbotTestDialogProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [pendingVariable, setPendingVariable] = useState<string | null>(null);
  const [flowEnded, setFlowEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Highlight current node in the canvas
  useEffect(() => {
    onHighlightNode?.(currentNodeId);
  }, [currentNodeId, onHighlightNode]);

  // Start the flow when dialog opens
  useEffect(() => {
    if (open) {
      resetTest();
    }
  }, [open]);

  const resetTest = () => {
    setMessages([]);
    setVariables({});
    setCurrentNodeId(null);
    setIsProcessing(false);
    setWaitingForInput(false);
    setPendingVariable(null);
    setFlowEnded(false);
    
    // Find and start from the start node
    const startNode = nodes.find(n => n.type === 'start');
    if (startNode) {
      setTimeout(() => {
        processNode(startNode.id);
      }, 500);
    } else {
      addMessage('system', '⚠️ Nenhum nó de início encontrado no fluxo.');
    }
  };

  const addMessage = (
    role: 'bot' | 'user' | 'system',
    content: string,
    options?: string[],
    nodeId?: string
  ) => {
    setMessages(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        options,
        nodeId,
        timestamp: new Date(),
      },
    ]);
  };

  const findNextNode = (nodeId: string, sourceHandle?: string): Node | null => {
    const edge = edges.find(e => 
      e.source === nodeId && 
      (sourceHandle ? e.sourceHandle === sourceHandle : true)
    );
    if (!edge) return null;
    return nodes.find(n => n.id === edge.target) || null;
  };

  const evaluateCondition = (
    conditions: Array<{ variable: string; operator: string; value: string }>,
    logicOperator: string
  ): boolean => {
    const results = conditions.map(cond => {
      const varValue = variables[cond.variable] || '';
      const compareValue = cond.value;
      
      switch (cond.operator) {
        case 'equals':
          return varValue.toLowerCase() === compareValue.toLowerCase();
        case 'not_equals':
          return varValue.toLowerCase() !== compareValue.toLowerCase();
        case 'contains':
          return varValue.toLowerCase().includes(compareValue.toLowerCase());
        case 'not_contains':
          return !varValue.toLowerCase().includes(compareValue.toLowerCase());
        case 'starts_with':
          return varValue.toLowerCase().startsWith(compareValue.toLowerCase());
        case 'ends_with':
          return varValue.toLowerCase().endsWith(compareValue.toLowerCase());
        case 'is_empty':
          return !varValue || varValue.trim() === '';
        case 'is_not_empty':
          return !!varValue && varValue.trim() !== '';
        case 'greater_than':
          return parseFloat(varValue) > parseFloat(compareValue);
        case 'less_than':
          return parseFloat(varValue) < parseFloat(compareValue);
        default:
          return false;
      }
    });

    return logicOperator === 'and' 
      ? results.every(r => r)
      : results.some(r => r);
  };

  const replaceVariables = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] || `{{${varName}}}`);
  };

  const processNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      addMessage('system', '⚠️ Nó não encontrado.');
      return;
    }

    setCurrentNodeId(nodeId);
    setIsProcessing(true);

    // Small delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 300));

    const data = node.data as Record<string, any>;

    switch (node.type) {
      case 'start':
        addMessage('system', '🚀 Fluxo iniciado');
        const nextFromStart = findNextNode(nodeId);
        if (nextFromStart) {
          processNode(nextFromStart.id);
        } else {
          addMessage('system', '⚠️ Nenhuma conexão a partir do início.');
          setIsProcessing(false);
        }
        break;

      case 'message':
        const message = replaceVariables(data.message || 'Mensagem não configurada');
        addMessage('bot', message, undefined, nodeId);
        
        // Handle delay if configured
        const delay = data.delay || 0;
        if (delay > 0) {
          addMessage('system', `⏱️ Aguardando ${delay}s...`);
          await new Promise(resolve => setTimeout(resolve, Math.min(delay * 100, 2000))); // Max 2s real delay
        }
        
        const nextFromMessage = findNextNode(nodeId);
        if (nextFromMessage) {
          processNode(nextFromMessage.id);
        } else {
          setIsProcessing(false);
        }
        break;

      case 'question':
        const question = replaceVariables(data.question || 'Pergunta não configurada');
        const options = data.options as string[] | undefined;
        addMessage('bot', question, options, nodeId);
        setWaitingForInput(true);
        setPendingVariable(data.variable || null);
        setIsProcessing(false);
        break;

      case 'condition':
        const conditionMode = data.conditionMode || 'variable';
        
        if (conditionMode === 'variable') {
          const conditions = data.conditions || [];
          const logicOperator = data.logicOperator || 'and';
          const result = evaluateCondition(conditions, logicOperator);
          
          addMessage('system', `🔀 Condição avaliada: ${result ? 'Verdadeiro' : 'Falso'}`);
          
          // Find the correct path based on result
          const nextPath = findNextNode(nodeId, result ? 'yes' : 'no');
          if (nextPath) {
            processNode(nextPath.id);
          } else {
            addMessage('system', `⚠️ Caminho "${result ? 'sim' : 'não'}" não conectado.`);
            setIsProcessing(false);
          }
        } else {
          // AI condition mode - simulate random choice for testing
          addMessage('system', '🤖 Condição IA (simulado para teste)');
          const nextFromCondition = findNextNode(nodeId, 'yes');
          if (nextFromCondition) {
            processNode(nextFromCondition.id);
          } else {
            setIsProcessing(false);
          }
        }
        break;

      case 'action':
        const actionType = data.actionType || 'unknown';
        const config = data.config || {};
        
        let actionMessage = '';
        switch (actionType) {
          case 'add_tag':
            actionMessage = `🏷️ Tag adicionada: ${config.tagName || 'N/A'}`;
            break;
          case 'remove_tag':
            actionMessage = `🏷️ Tag removida: ${config.tagName || 'N/A'}`;
            break;
          case 'set_variable':
            if (config.variableName && config.variableValue) {
              const value = replaceVariables(config.variableValue);
              setVariables(prev => ({ ...prev, [config.variableName]: value }));
              actionMessage = `📝 Variável definida: ${config.variableName} = ${value}`;
            }
            break;
          case 'transfer_to_human':
            actionMessage = '👤 Transferido para atendente humano';
            break;
          case 'move_to_funnel':
            actionMessage = `📊 Movido para funil: ${config.funnelId || 'N/A'}`;
            break;
          case 'send_notification':
            actionMessage = `🔔 Notificação enviada`;
            break;
          case 'webhook':
            actionMessage = `🌐 Webhook chamado: ${config.webhookUrl || 'N/A'}`;
            break;
          default:
            actionMessage = `⚙️ Ação executada: ${actionType}`;
        }
        
        addMessage('system', actionMessage);
        
        const nextFromAction = findNextNode(nodeId);
        if (nextFromAction) {
          processNode(nextFromAction.id);
        } else {
          setIsProcessing(false);
        }
        break;

      case 'delay':
        const delayDuration = data.duration || 5;
        const unit = data.unit || 'seconds';
        const unitLabel = unit === 'seconds' ? 's' : unit === 'minutes' ? 'min' : 'h';
        
        addMessage('system', `⏳ Delay: ${delayDuration}${unitLabel} (simulado)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const nextFromDelay = findNextNode(nodeId);
        if (nextFromDelay) {
          processNode(nextFromDelay.id);
        } else {
          setIsProcessing(false);
        }
        break;

      case 'ai_response':
        addMessage('system', '🤖 Gerando resposta IA (simulado)...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const aiPrompt = data.prompt || 'Resposta padrão da IA';
        addMessage('bot', `[Resposta IA simulada]\n${replaceVariables(aiPrompt)}`, undefined, nodeId);
        
        const nextFromAI = findNextNode(nodeId);
        if (nextFromAI) {
          processNode(nextFromAI.id);
        } else {
          setIsProcessing(false);
        }
        break;

      case 'end':
        addMessage('system', '✅ Fluxo finalizado');
        setFlowEnded(true);
        setIsProcessing(false);
        break;

      default:
        addMessage('system', `⚠️ Tipo de nó desconhecido: ${node.type}`);
        const nextDefault = findNextNode(nodeId);
        if (nextDefault) {
          processNode(nextDefault.id);
        } else {
          setIsProcessing(false);
        }
    }
  };

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    
    const userInput = input.trim();
    setInput('');
    addMessage('user', userInput);
    
    if (waitingForInput && currentNodeId) {
      // Save variable if needed
      if (pendingVariable) {
        setVariables(prev => ({ ...prev, [pendingVariable]: userInput }));
      }
      
      setWaitingForInput(false);
      setPendingVariable(null);
      
      // Find next node and continue
      const nextNode = findNextNode(currentNodeId);
      if (nextNode) {
        processNode(nextNode.id);
      } else {
        addMessage('system', '⚠️ Fluxo interrompido - nenhuma conexão encontrada.');
      }
    }
  };

  const handleOptionClick = (option: string) => {
    if (isProcessing) return;
    
    setInput('');
    addMessage('user', option);
    
    if (waitingForInput && currentNodeId) {
      if (pendingVariable) {
        setVariables(prev => ({ ...prev, [pendingVariable]: option }));
      }
      
      setWaitingForInput(false);
      setPendingVariable(null);
      
      const nextNode = findNextNode(currentNodeId);
      if (nextNode) {
        processNode(nextNode.id);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[600px] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Testar Fluxo: {flowName}
          </DialogTitle>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'system' ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                    {msg.content.startsWith('⏳') || msg.content.startsWith('⏱️') ? (
                      <Clock className="h-3 w-3" />
                    ) : msg.content.startsWith('✅') ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : msg.content.startsWith('⚠️') ? (
                      <AlertCircle className="h-3 w-3 text-yellow-500" />
                    ) : null}
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === 'bot' ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span className="text-xs opacity-70">
                        {msg.role === 'bot' ? 'Bot' : 'Você'}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* Options buttons */}
                    {msg.options && msg.options.length > 0 && waitingForInput && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.options.map((opt, i) => (
                          <Button
                            key={i}
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOptionClick(opt)}
                            disabled={isProcessing}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Variables Display */}
        {Object.keys(variables).length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Variáveis coletadas:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(variables).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 py-3 border-t flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={resetTest}
            title="Reiniciar teste"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              flowEnded
                ? 'Fluxo finalizado - clique em reiniciar'
                : waitingForInput
                ? 'Digite sua resposta...'
                : 'Aguarde o bot...'
            }
            disabled={isProcessing || flowEnded || !waitingForInput}
            className="flex-1"
          />
          
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing || flowEnded || !waitingForInput}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
