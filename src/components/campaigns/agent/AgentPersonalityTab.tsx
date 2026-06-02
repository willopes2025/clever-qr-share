import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, MessageSquare, AlertCircle, Smile, Volume2, Play, Square, Loader2, RefreshCw } from 'lucide-react';
import { useElevenLabsVoices } from '@/hooks/useElevenLabsVoices';

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
  activeHoursWindows?: Array<{ start: number; end: number; days: number[] }>;
  setActiveHoursWindows?: (value: Array<{ start: number; end: number; days: number[] }>) => void;
  handoffKeywords: string[];
  setHandoffKeywords: (value: string[]) => void;
  responseMode: 'text' | 'audio' | 'both' | 'adaptive';
  setResponseMode: (value: 'text' | 'audio' | 'both' | 'adaptive') => void;
  voiceId: string;
  setVoiceId: (value: string) => void;
}

// Voice Settings sub-component
interface VoiceSettingsProps {
  responseMode: 'text' | 'audio' | 'both' | 'adaptive';
  setResponseMode: (value: 'text' | 'audio' | 'both' | 'adaptive') => void;
  voiceId: string;
  setVoiceId: (value: string) => void;
}

const VoiceSettings = ({ responseMode, setResponseMode, voiceId, setVoiceId }: VoiceSettingsProps) => {
  const { 
    voices, 
    clonedVoices, 
    premadeVoices, 
    isLoading, 
    refetch, 
    playPreview, 
    stopCurrentAudio,
    playingVoiceId 
  } = useElevenLabsVoices();

  const isPlaying = playingVoiceId === voiceId;
  const isVoiceDisabled = responseMode === 'text';

  const getVoiceIcon = (voice: { labels?: { gender?: string } }) => {
    return voice.labels?.gender === 'female' ? '👩' : '👨';
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Volume2 className="h-4 w-4" />
          Configurações de Voz (ElevenLabs)
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-8"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Modo de Resposta</Label>
          <Select 
            value={responseMode} 
            onValueChange={(v) => setResponseMode(v as 'text' | 'audio' | 'both' | 'adaptive')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o modo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adaptive">🔄 Adaptativo (espelha cliente)</SelectItem>
              <SelectItem value="text">📝 Sempre Texto</SelectItem>
              <SelectItem value="audio">🎵 Sempre Áudio</SelectItem>
              <SelectItem value="both">📝🎵 Texto + Áudio</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Adaptativo: responde no mesmo formato que o cliente enviou
          </p>
        </div>

        <div className="space-y-2">
          <Label>Voz ElevenLabs</Label>
          <div className="flex gap-2">
            <Select 
              value={voiceId} 
              onValueChange={setVoiceId}
              disabled={isVoiceDisabled}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={isLoading ? "Carregando vozes..." : "Selecione uma voz"} />
              </SelectTrigger>
              <SelectContent>
                {/* Cloned Voices */}
                {clonedVoices.length > 0 && (
                  <>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold">🎤 Minhas Vozes Clonadas</SelectLabel>
                      {clonedVoices.map((voice) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                  </>
                )}
                
                {/* Premade/Professional Voices */}
                <SelectGroup>
                  <SelectLabel className="text-xs font-semibold">👥 Vozes Padrão</SelectLabel>
                  {premadeVoices.map((voice) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      {getVoiceIcon(voice)} {voice.name}
                    </SelectItem>
                  ))}
                </SelectGroup>

                {/* Fallback if no voices loaded */}
                {voices.length === 0 && !isLoading && (
                  <SelectItem value="" disabled>
                    Nenhuma voz encontrada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Test Voice Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (isPlaying) {
                  stopCurrentAudio();
                } else {
                  playPreview(voiceId);
                }
              }}
              disabled={!voiceId || isVoiceDisabled || (playingVoiceId !== null && playingVoiceId !== voiceId)}
              title={isPlaying ? "Parar" : "Testar voz"}
            >
              {playingVoiceId === voiceId ? (
                <Square className="h-4 w-4" />
              ) : playingVoiceId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isVoiceDisabled 
              ? 'Ative o modo áudio para selecionar uma voz'
              : 'Escolha uma voz e clique ▶️ para testar'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

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
  activeHoursWindows,
  setActiveHoursWindows,
  handoffKeywords,
  setHandoffKeywords,
  responseMode,
  setResponseMode,
  voiceId,
  setVoiceId,
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

      {/* Voice Settings */}
      <VoiceSettings 
        responseMode={responseMode}
        setResponseMode={setResponseMode}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
      />

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
