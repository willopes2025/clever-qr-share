import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Image as ImageIcon, Video, Mic, FileText, Plus, Trash2, MessageSquare, BadgeCheck } from 'lucide-react';
import {
  useAgentMediaLibrary,
  useStageMedia,
  useStageMediaMutations,
  useInternalTemplatesForAttach,
  useMetaTemplatesForAttach,
  type AgentMediaType,
  type StageMediaTrigger,
  type StageAttachmentType,
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
  const { data: internalTemplates = [] } = useInternalTemplatesForAttach();
  const { data: metaTemplates = [] } = useMetaTemplatesForAttach();
  const { data: attached = [] } = useStageMedia(stageId);
  const { attach, update, detach } = useStageMediaMutations();

  const [open, setOpen] = useState(false);
  const [attachmentType, setAttachmentType] = useState<StageAttachmentType>('media');
  const [mediaId, setMediaId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [metaTemplateId, setMetaTemplateId] = useState<string>('');
  const [trigger, setTrigger] = useState<StageMediaTrigger>('on_enter');
  const [delay, setDelay] = useState(2);
  const [captionOverride, setCaptionOverride] = useState('');

  const resetForm = () => {
    setAttachmentType('media');
    setMediaId('');
    setTemplateId('');
    setMetaTemplateId('');
    setCaptionOverride('');
    setDelay(2);
    setTrigger('on_enter');
  };

  const canSubmit =
    (attachmentType === 'media' && !!mediaId) ||
    (attachmentType === 'template' && !!templateId) ||
    (attachmentType === 'meta_template' && !!metaTemplateId);

  const handleAttach = async () => {
    if (!canSubmit) return;
    await attach.mutateAsync({
      stage_id: stageId,
      attachment_type: attachmentType,
      media_id: attachmentType === 'media' ? mediaId : null,
      template_id: attachmentType === 'template' ? templateId : null,
      meta_template_id: attachmentType === 'meta_template' ? metaTemplateId : null,
      trigger_type: trigger,
      delay_seconds: delay,
      caption_override: captionOverride.trim() || null,
      order_index: attached.length,
    });
    setOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Anexos da etapa</Label>
          <p className="text-xs text-muted-foreground">
            Mídias da biblioteca, templates internos ou templates Meta enviados automaticamente.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Anexar
        </Button>
      </div>

      {attached.length === 0 ? (
        <Card className="p-3 text-xs text-muted-foreground text-center">
          Nenhum anexo nesta etapa.
        </Card>
      ) : (
        <div className="space-y-2">
          {attached.map((a) => {
            let Icon: React.ElementType = FileText;
            let title = 'Anexo';
            let typeLabel = '';
            if (a.attachment_type === 'media' && a.media) {
              Icon = TYPE_ICON[a.media.media_type];
              title = a.media.name;
              typeLabel = 'Mídia';
            } else if (a.attachment_type === 'template' && a.template) {
              Icon = MessageSquare;
              title = a.template.name;
              typeLabel = 'Template';
            } else if (a.attachment_type === 'meta_template' && a.meta_template) {
              Icon = BadgeCheck;
              title = `${a.meta_template.name} (${a.meta_template.language})`;
              typeLabel = 'Meta';
            } else {
              return null;
            }
            return (
              <Card key={a.id} className="p-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
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

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Anexar à etapa</DialogTitle>
            <DialogDescription>
              Escolha uma mídia da biblioteca, um template do sistema ou um template Meta aprovado.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={attachmentType} onValueChange={(v) => setAttachmentType(v as StageAttachmentType)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="media">Mídia</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="meta_template">Template Meta</TabsTrigger>
            </TabsList>

            <TabsContent value="media" className="space-y-2 pt-3">
              <Label>Mídia da biblioteca</Label>
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
            </TabsContent>

            <TabsContent value="template" className="space-y-2 pt-3">
              <Label>Template do sistema</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={internalTemplates.length === 0 ? 'Nenhum template ativo' : 'Selecione...'} />
                </SelectTrigger>
                <SelectContent>
                  {internalTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.media_type ? ` • ${t.media_type}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                As variáveis ({'{{nome}}'}, {'{{empresa}}'} etc.) são substituídas automaticamente no envio.
              </p>
            </TabsContent>

            <TabsContent value="meta_template" className="space-y-2 pt-3">
              <Label>Template Meta aprovado</Label>
              <Select value={metaTemplateId} onValueChange={setMetaTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={metaTemplates.length === 0 ? 'Nenhum template Meta' : 'Selecione...'} />
                </SelectTrigger>
                <SelectContent>
                  {metaTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} • {t.language} {t.status ? `• ${t.status}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Em conversas Meta, o template é enviado oficialmente. Em conversas Evolution, o corpo é enviado como texto.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-3 pt-2">
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
            {attachmentType === 'media' && (
              <div>
                <Label>Legenda específica desta etapa (opcional)</Label>
                <Input
                  value={captionOverride}
                  onChange={(e) => setCaptionOverride(e.target.value)}
                  placeholder="Substitui a legenda padrão da mídia"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAttach} disabled={!canSubmit}>
              Anexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
