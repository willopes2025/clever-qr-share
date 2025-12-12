import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useBroadcastLists } from '@/hooks/useBroadcastLists';
import { Campaign } from '@/hooks/useCampaigns';
import { Calendar, Clock } from 'lucide-react';

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign | null;
  onSubmit: (data: {
    name: string;
    template_id: string | null;
    list_id: string | null;
    scheduled_at: string | null;
  }) => void;
  isLoading?: boolean;
}

export const CampaignFormDialog = ({
  open,
  onOpenChange,
  campaign,
  onSubmit,
  isLoading,
}: CampaignFormDialogProps) => {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [listId, setListId] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const { templates } = useMessageTemplates();
  const { lists } = useBroadcastLists();

  const activeTemplates = templates?.filter(t => t.is_active) || [];

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setTemplateId(campaign.template_id || '');
      setListId(campaign.list_id || '');
      if (campaign.scheduled_at) {
        setIsScheduled(true);
        const date = new Date(campaign.scheduled_at);
        setScheduledDate(date.toISOString().split('T')[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
      } else {
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
      }
    } else {
      setName('');
      setTemplateId('');
      setListId('');
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [campaign, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let scheduledAt: string | null = null;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    onSubmit({
      name,
      template_id: templateId || null,
      list_id: listId || null,
      scheduled_at: scheduledAt,
    });
  };

  const selectedTemplate = activeTemplates.find(t => t.id === templateId);
  const selectedList = lists?.find(l => l.id === listId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {campaign ? 'Editar Campanha' : 'Nova Campanha'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Black Friday 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Template de Mensagem</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground line-clamp-3">
                  {selectedTemplate.content}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Lista de Transmissão</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista" />
              </SelectTrigger>
              <SelectContent>
                {lists?.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name} ({list.contact_count} contatos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedList && (
              <p className="text-sm text-muted-foreground">
                {selectedList.contact_count} contatos serão notificados
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Agendar Envio</Label>
                <p className="text-sm text-muted-foreground">
                  Defina data e hora para envio automático
                </p>
              </div>
              <Switch
                checked={isScheduled}
                onCheckedChange={setIsScheduled}
              />
            </div>

            {isScheduled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required={isScheduled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Hora
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    required={isScheduled}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {campaign ? 'Salvar' : 'Criar Campanha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
