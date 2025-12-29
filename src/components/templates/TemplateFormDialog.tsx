import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  MessageTemplate, 
  CreateTemplateData, 
  TemplateCategory, 
  CATEGORY_LABELS,
  extractVariables,
  MediaType
} from '@/hooks/useMessageTemplates';
import { VariableAutocomplete } from './VariableAutocomplete';
import { TemplateMediaUpload } from './TemplateMediaUpload';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSubmit: (data: CreateTemplateData) => void;
  isLoading?: boolean;
}

export const TemplateFormDialog = ({
  open,
  onOpenChange,
  template,
  onSubmit,
  isLoading
}: TemplateFormDialogProps) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('other');
  const [isActive, setIsActive] = useState(true);
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  
  // Media state
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setCategory(template.category);
      setIsActive(template.is_active);
      setMediaType(template.media_type || null);
      setMediaUrl(template.media_url || null);
      setMediaFilename(template.media_filename || null);
    } else {
      setName('');
      setContent('');
      setCategory('other');
      setIsActive(true);
      setMediaType(null);
      setMediaUrl(null);
      setMediaFilename(null);
    }
  }, [template, open]);

  useEffect(() => {
    setDetectedVariables(extractVariables(content));
  }, [content]);

  const handleMediaChange = (type: MediaType, url: string | null, filename: string | null) => {
    setMediaType(type);
    setMediaUrl(url);
    setMediaFilename(filename);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      content,
      category,
      variables: detectedVariables,
      is_active: isActive,
      media_type: mediaType,
      media_url: mediaUrl,
      media_filename: mediaFilename
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {template ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
          <DialogDescription>
            {template ? 'Edite as configurações do seu template.' : 'Crie um novo template de mensagem com variáveis dinâmicas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Boas-vindas Cliente"
                required
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Media Upload Section */}
          <TemplateMediaUpload
            mediaType={mediaType}
            mediaUrl={mediaUrl}
            mediaFilename={mediaFilename}
            onMediaChange={handleMediaChange}
          />

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo da Mensagem</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Digite <span className="font-mono bg-muted px-1 rounded">{'{{'}</span> para inserir uma variável
            </p>
            <VariableAutocomplete
              value={content}
              onChange={setContent}
              placeholder="Digite o conteúdo do template. Use {{ para inserir variáveis dinâmicas."
              rows={6}
              className="bg-background border-border font-mono text-sm"
            />
          </div>

          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>Variáveis Detectadas</Label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((v) => (
                  <Badge key={v} variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="is-active">Template Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Templates inativos não aparecem na seleção de campanhas
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {template ? 'Salvar Alterações' : 'Criar Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
