import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, MessageSquare, AlertCircle, Smile } from 'lucide-react';

interface AgentPersonalityTabProps {
  agentName: string;
  setAgentName: (value: string) => void;
  personalityPrompt: string;
  setPersonalityPrompt: (value: string) => void;
  behaviorRules: string;
  setBehaviorRules: (value: string) => void;
  greetingMessage: string;
  setGreetingMessage: (value: string) => void;
  fallbackMessage: string;
  setFallbackMessage: (value: string) => void;
  goodbyeMessage: string;
  setGoodbyeMessage: (value: string) => void;
  maxInteractions: number;
  setMaxInteractions: (value: number) => void;
  responseDelayMin: number;
  setResponseDelayMin: (value: number) => void;
  responseDelayMax: number;
  setResponseDelayMax: (value: number) => void;
  activeHoursStart: number;
  setActiveHoursStart: (value: number) => void;
  activeHoursEnd: number;
  setActiveHoursEnd: (value: number) => void;
  handoffKeywords: string[];
  setHandoffKeywords: (value: string[]) => void;
}

export const AgentPersonalityTab = ({
  agentName,
  setAgentName,
  personalityPrompt,
  setPersonalityPrompt,
  behaviorRules,
  setBehaviorRules,
  greetingMessage,
  setGreetingMessage,
  fallbackMessage,
  setFallbackMessage,
  goodbyeMessage,
  setGoodbyeMessage,
  maxInteractions,
  setMaxInteractions,
  responseDelayMin,
  setResponseDelayMin,
  responseDelayMax,
  setResponseDelayMax,
  activeHoursStart,
  setActiveHoursStart,
  activeHoursEnd,
  setActiveHoursEnd,
  handoffKeywords,
  setHandoffKeywords,
}: AgentPersonalityTabProps) => {
  const handleAddKeyword = (keyword: string) => {
    if (keyword.trim() && !handoffKeywords.includes(keyword.trim().toLowerCase())) {
      setHandoffKeywords([...handoffKeywords, keyword.trim().toLowerCase()]);
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setHandoffKeywords(handoffKeywords.filter(k => k !== keyword));
  };

  return (
    <div className="space-y-6">
      {/* Basic Identity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Bot className="h-4 w-4" />
          Identidade do Agente
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="agentName">Nome do Agente</Label>
          <Input
            id="agentName"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Ex: Ana, Assistente Virtual, etc."
          />
          <p className="text-xs text-muted-foreground">
            Nome que aparecerá nas conversas e identificará o agente
          </p>
        </div>
      </div>

      {/* Personality & Behavior */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Smile className="h-4 w-4" />
          Personalidade
        </div>

        <div className="space-y-2">
          <Label>Prompt de Personalidade</Label>
          <Textarea
            value={personalityPrompt}
            onChange={(e) => setPersonalityPrompt(e.target.value)}
            placeholder="Descreva a personalidade do agente. Ex: Você é uma assistente simpática e profissional chamada Ana. Você trabalha na empresa XYZ e ajuda clientes com dúvidas sobre produtos e serviços. Seja sempre cordial e use linguagem informal mas profissional..."
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Defina como o agente deve se comportar, qual tom usar, como se apresentar
          </p>
        </div>

        <div className="space-y-2">
          <Label>Regras de Comportamento</Label>
          <Textarea
            value={behaviorRules}
            onChange={(e) => setBehaviorRules(e.target.value)}
            placeholder="Liste regras específicas. Ex:
- Nunca invente informações que não estão na base de conhecimento
- Sempre confirme o pedido antes de finalizar
- Se não souber a resposta, ofereça falar com um atendente
- Não discuta política ou assuntos polêmicos"
            rows={5}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Regras que o agente deve seguir rigorosamente
          </p>
        </div>
      </div>

      {/* Default Messages */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          Mensagens Padrão
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mensagem de Boas-vindas</Label>
            <Textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              placeholder="Olá! Sou a Ana, assistente virtual da empresa XYZ. Como posso ajudar você hoje?"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Despedida</Label>
            <Textarea
              value={goodbyeMessage}
              onChange={(e) => setGoodbyeMessage(e.target.value)}
              placeholder="Foi um prazer ajudar! Se tiver mais dúvidas, estou por aqui. Até logo! 👋"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Mensagem Fallback
          </Label>
          <Textarea
            value={fallbackMessage}
            onChange={(e) => setFallbackMessage(e.target.value)}
            placeholder="Desculpe, não consegui entender sua mensagem. Poderia reformular? Ou se preferir, posso chamar um atendente para ajudar."
            rows={2}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Usada quando o agente não consegue entender ou responder
          </p>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-4 border-t pt-4">
        <div className="text-sm font-medium text-muted-foreground">
          Configurações Operacionais
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Horário de Funcionamento</Label>
            <div className="flex gap-2 items-center">
              <Select 
                value={activeHoursStart.toString()} 
                onValueChange={(v) => setActiveHoursStart(parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">até</span>
              <Select 
                value={activeHoursEnd.toString()} 
                onValueChange={(v) => setActiveHoursEnd(parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Máx. Interações por Conversa</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={maxInteractions}
              onChange={(e) => setMaxInteractions(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de trocas de mensagens antes de solicitar atendimento humano. Use 0 para ilimitado.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tempo de Resposta (segundos)</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={60}
              value={responseDelayMin}
              onChange={(e) => setResponseDelayMin(parseInt(e.target.value) || 3)}
              className="w-20"
            />
            <span className="text-muted-foreground">a</span>
            <Input
              type="number"
              min={1}
              max={120}
              value={responseDelayMax}
              onChange={(e) => setResponseDelayMax(parseInt(e.target.value) || 8)}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">segundos</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Simula tempo de digitação para parecer mais natural
          </p>
        </div>

        <div className="space-y-2">
          <Label>Palavras-chave para Atendimento Humano</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {handoffKeywords.map((keyword) => (
              <span
                key={keyword}
                className="px-2 py-1 bg-muted text-sm rounded-full flex items-center gap-1"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="hover:text-destructive ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nova palavra-chave"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyword((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Quando detectadas, o agente para e solicita atendimento humano
          </p>
        </div>
      </div>
    </div>
  );
};
