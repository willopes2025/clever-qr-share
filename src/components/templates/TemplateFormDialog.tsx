import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  MessageTemplate, 
  CreateTemplateData, 
  TemplateCategory, 
  CATEGORY_LABELS,
  extractVariables 
} from '@/hooks/useMessageTemplates';
import { Variable } from 'lucide-react';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSubmit: (data: CreateTemplateData) => void;
  isLoading?: boolean;
}

const SAMPLE_VARIABLES = [
  { name: 'nome', description: 'Nome do contato' },
  { name: 'telefone', description: 'Telefone do contato' },
  { name: 'email', description: 'Email do contato' },
  { name: 'empresa', description: 'Nome da empresa' },
  { name: 'produto', description: 'Nome do produto' },
  { name: 'valor', description: 'Valor/Preço' },
  { name: 'data', description: 'Data específica' },
  { name: 'link', description: 'Link/URL' }
];

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

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setCategory(template.category);
      setIsActive(template.is_active);
    } else {
      setName('');
      setContent('');
      setCategory('other');
      setIsActive(true);
    }
  }, [template, open]);

  useEffect(() => {
    setDetectedVariables(extractVariables(content));
  }, [content]);

  const insertVariable = (varName: string) => {
    setContent(prev => prev + `{{${varName}}}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      content,
      category,
      variables: detectedVariables,
      is_active: isActive
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

          <div className="space-y-2">
            <Label>Variáveis Disponíveis</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
              {SAMPLE_VARIABLES.map((v) => (
                <Button
                  key={v.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(v.name)}
                  className="text-xs"
                  title={v.description}
                >
                  <Variable className="h-3 w-3 mr-1" />
                  {`{{${v.name}}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo da Mensagem</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite o conteúdo do template. Use {{variavel}} para inserir variáveis dinâmicas."
              required
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
