import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Image as ImageIcon, Video, Mic, FileText, Plus, Trash2 } from 'lucide-react';
import {
  useAgentMediaLibrary,
  useStageMedia,
  useStageMediaMutations,
  type AgentMediaType,
  type StageMediaTrigger,
} from '@/hooks/useAgentMediaLibrary';

const TYPE_ICON: Record<AgentMediaType, React.ElementType> = {
  image: ImageIcon,
  video: Video,
  audio: Mic,
  document: FileText,
};

const TRIGGER_LABEL: Record<StageMediaTrigger, string> = {
  on_enter: 'Ao entrar na etapa',
  after_message: 'Após a resposta de texto',
  on_demand: 'Quando a IA decidir (sob demanda)',
};

interface Props {
  stageId: string;
}

export const StageMediaManager = ({ stageId }: Props) => {
  const { data: library = [] } = useAgentMediaLibrary();
  const { data: attached = [] } = useStageMedia(stageId);
  const { attach, update, detach } = useStageMediaMutations();

  const [open, setOpen] = useState(false);
  const [mediaId, setMediaId] = useState<string>('');
  const [trigger, setTrigger] = useState<StageMediaTrigger>('on_enter');
  const [delay, setDelay] = useState(2);
  const [captionOverride, setCaptionOverride] = useState('');

  const handleAttach = async () => {
    if (!mediaId) return;
    await attach.mutateAsync({
      stage_id: stageId,
      media_id: mediaId,
      trigger_type: trigger,
      delay_seconds: delay,
      caption_override: captionOverride.trim() || null,
      order_index: attached.length,
    });
    setOpen(false);
    setMediaId('');
    setCaptionOverride('');
    setDelay(2);
    setTrigger('on_enter');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Mídias anexadas a esta etapa</Label>
          <p className="text-xs text-muted-foreground">
            Imagens, vídeos, PDFs ou áudios da biblioteca enviados automaticamente.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Anexar
        </Button>
      </div>

      {attached.length === 0 ? (
        <Card className="p-3 text-xs text-muted-foreground text-center">
          Nenhuma mídia anexada.
        </Card>
      ) : (
        <div className="space-y-2">
          {attached.map((a) => {
            if (!a.media) return null;
            const Icon = TYPE_ICON[a.media.media_type];
            return (
              <Card key={a.id} className="p-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.media.name}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {TRIGGER_LABEL[a.trigger_type]}
                    </Badge>
                    {a.trigger_type !== 'on_demand' && (
                      <Badge variant="outline" className="text-[10px]">
                        atraso {a.delay_seconds}s
                      </Badge>
                    )}
                  </div>
                </div>
                <Select
                  value={a.trigger_type}
                  onValueChange={(v: StageMediaTrigger) =>
                    update.mutate({ id: a.id, stage_id: stageId, trigger_type: v })
                  }
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_enter">Ao entrar</SelectItem>
                    <SelectItem value="after_message">Após resposta</SelectItem>
                    <SelectItem value="on_demand">Sob demanda</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => detach.mutate({ id: a.id, stage_id: stageId })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar mídia à etapa</DialogTitle>
            <DialogDescription>
              Escolha uma mídia da biblioteca e quando ela deve ser disparada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mídia</Label>
              <Select value={mediaId} onValueChange={setMediaId}>
                <SelectTrigger>
                  <SelectValue placeholder={library.length === 0 ? 'Biblioteca vazia — adicione na aba Mídias' : 'Selecione...'} />
                </SelectTrigger>
                <SelectContent>
                  {library.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      [{m.media_type}] {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gatilho</Label>
              <Select value={trigger} onValueChange={(v: StageMediaTrigger) => setTrigger(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_enter">Ao entrar na etapa</SelectItem>
                  <SelectItem value="after_message">Após a resposta de texto</SelectItem>
                  <SelectItem value="on_demand">Quando a IA decidir (sob demanda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {trigger !== 'on_demand' && (
              <div>
                <Label>Atraso antes de enviar (segundos)</Label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={delay}
                  onChange={(e) => setDelay(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            )}
            <div>
              <Label>Legenda específica desta etapa (opcional)</Label>
              <Input
                value={captionOverride}
                onChange={(e) => setCaptionOverride(e.target.value)}
                placeholder="Substitui a legenda padrão da mídia"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAttach} disabled={!mediaId}>
              Anexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
