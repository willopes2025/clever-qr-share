import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { MessageSquare, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type MessageMode = 'template' | 'manual';

export interface ScheduledMessageData {
  mode: MessageMode;
  templateId: string | null;
  content: string;
}

interface MessageSelectorProps {
  value: ScheduledMessageData | null;
  onChange: (value: ScheduledMessageData | null) => void;
  dueDate?: string;
  dueTime?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function MessageSelector({
  value,
  onChange,
  dueDate,
  dueTime,
  compact = false,
  disabled = false,
}: MessageSelectorProps) {
  const { templates, isLoading } = useMessageTemplates();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MessageMode>(value?.mode || 'template');
  const [templateId, setTemplateId] = useState<string>(value?.templateId || '');
  const [manualContent, setManualContent] = useState<string>(value?.content || '');

  const activeTemplates = templates.filter(t => t.is_active);
  const selectedTemplate = templates.find(t => t.id === templateId);
  const hasMessage = value && (value.templateId || value.content);

  const handleConfirm = () => {
    if (mode === 'template' && templateId) {
      onChange({
        mode: 'template',
        templateId,
        content: selectedTemplate?.content || '',
      });
    } else if (mode === 'manual' && manualContent.trim()) {
      onChange({
        mode: 'manual',
        templateId: null,
        content: manualContent.trim(),
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setTemplateId('');
    setManualContent('');
    setMode('template');
    setOpen(false);
  };

  const handleModeChange = (newMode: MessageMode) => {
    setMode(newMode);
    if (newMode === 'template') {
      setManualContent('');
    } else {
      setTemplateId('');
    }
  };

  const getScheduledLabel = () => {
    if (!dueDate) return null;
    const date = new Date(dueDate + 'T00:00:00');
    const formattedDate = format(date, "dd/MM", { locale: ptBR });
    return dueTime ? `${formattedDate} às ${dueTime.slice(0, 5)}` : formattedDate;
  };

  const isValid = (mode === 'template' && templateId) || (mode === 'manual' && manualContent.trim());
  const scheduledLabel = getScheduledLabel();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={hasMessage ? "default" : "outline"}
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-2",
            compact && "h-8 px-2 text-xs",
            hasMessage && "bg-primary text-primary-foreground"
          )}
          disabled={disabled}
        >
          <MessageSquare className={cn("h-4 w-4", compact && "h-3.5 w-3.5")} />
          {!compact && (hasMessage ? "Mensagem ✓" : "Mensagem")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Agendar Mensagem
            </h4>
            {hasMessage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={handleClear}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Remover
              </Button>
            )}
          </div>

          <RadioGroup value={mode} onValueChange={(v) => handleModeChange(v as MessageMode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="template" id="template" />
              <Label htmlFor="template" className="cursor-pointer">Selecionar Template</Label>
            </div>
            
            {mode === 'template' && (
              <div className="ml-6 mt-2">
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum template ativo
                      </div>
                    ) : (
                      activeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <p className="text-muted-foreground line-clamp-3">{selectedTemplate.content}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2 mt-3">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual" className="cursor-pointer">Escrever Manualmente</Label>
            </div>

            {mode === 'manual' && (
              <div className="ml-6 mt-2">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{{nome}}"} para incluir o nome do contato
                </p>
              </div>
            )}
          </RadioGroup>

          {scheduledLabel && (
            <div className="text-xs text-muted-foreground bg-muted rounded p-2">
              📅 Será enviada em: <strong>{scheduledLabel}</strong>
            </div>
          )}

          {!dueDate && (
            <div className="text-xs text-orange-600 bg-orange-500/10 rounded p-2">
              ⚠️ Defina uma data e hora para agendar o envio
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              size="sm" 
              onClick={handleConfirm} 
              disabled={!isValid || !dueDate || !dueTime}
            >
              <Check className="h-4 w-4 mr-1" />
              Confirmar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
