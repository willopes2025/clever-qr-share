import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Volume2, Sparkles, AlertTriangle, Square } from 'lucide-react';
import { useElevenLabsVoices } from '@/hooks/useElevenLabsVoices';
import { useGenerateTTS } from '@/hooks/useGenerateTTS';
import { toast } from 'sonner';

interface GenerateAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateContent: string;
  onAudioGenerated: (audioUrl: string, fileName: string) => void;
}

export const GenerateAudioDialog = ({
  open,
  onOpenChange,
  templateContent,
  onAudioGenerated
}: GenerateAudioDialogProps) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const { 
    voices, 
    clonedVoices, 
    premadeVoices, 
    isLoading: isLoadingVoices,
    playPreview,
    stopCurrentAudio,
    playingVoiceId
  } = useElevenLabsVoices();
  const { generateAudio, isGenerating } = useGenerateTTS();

  const handleGenerate = async () => {
    if (!selectedVoiceId) {
      toast.error('Selecione uma voz');
      return;
    }

    if (!templateContent.trim()) {
      toast.error('O template não tem conteúdo');
      return;
    }

    const result = await generateAudio(templateContent, selectedVoiceId);
    
    if (result) {
      onAudioGenerated(result.audioUrl, result.fileName);
      toast.success('Áudio gerado com sucesso!');
      onOpenChange(false);
    }
  };

  const handlePlayPreview = async () => {
    if (playingVoiceId === selectedVoiceId) {
      stopCurrentAudio();
    } else {
      setIsGeneratingPreview(true);
      try {
        await playPreview(selectedVoiceId, templateContent);
      } finally {
        setIsGeneratingPreview(false);
      }
    }
  };

  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Áudio com IA
          </DialogTitle>
          <DialogDescription>
            Converta o texto do seu template em áudio usando vozes da ElevenLabs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Text Preview */}
          <div className="space-y-2">
            <Label>Texto que será convertido</Label>
            <div className="p-3 bg-muted/30 rounded-lg border border-border max-h-32 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {templateContent || <span className="text-muted-foreground italic">Sem conteúdo</span>}
              </p>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label>Selecione a voz</Label>
            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId} disabled={isLoadingVoices}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder={isLoadingVoices ? "Carregando vozes..." : "Escolha uma voz"} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {clonedVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Vozes Clonadas
                    </div>
                    {clonedVoices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.name}</span>
                          {voice.labels?.gender && (
                            <span className="text-xs text-muted-foreground">
                              ({voice.labels.gender})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {premadeVoices.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Vozes Pré-feitas
                    </div>
                    {premadeVoices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.name}</span>
                          {voice.labels?.gender && (
                            <span className="text-xs text-muted-foreground">
                              ({voice.labels.gender})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Preview Button */}
          {selectedVoiceId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePlayPreview}
              disabled={isGenerating || isGeneratingPreview || !templateContent.trim()}
              className="w-full"
            >
              {isGeneratingPreview ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Preview...
                </>
              ) : playingVoiceId === selectedVoiceId ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Parar Preview
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Ouvir Preview do Áudio
                </>
              )}
            </Button>
          )}

          {/* Warning about variables */}
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm text-amber-200">
              Variáveis como <code className="bg-muted px-1 rounded">{`{{nome}}`}</code> serão lidas literalmente no áudio.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !selectedVoiceId || !templateContent.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Áudio
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
