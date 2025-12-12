import { MessageTemplate, CATEGORY_LABELS, CATEGORY_COLORS } from '@/hooks/useMessageTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Eye, Variable, FileText, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplateCardProps {
  template: MessageTemplate;
  variationsCount?: number;
  onEdit: (template: MessageTemplate) => void;
  onDelete: (id: string) => void;
  onPreview: (template: MessageTemplate) => void;
  onToggleActive: (id: string, is_active: boolean) => void;
  onManageVariations: (template: MessageTemplate) => void;
}

export const TemplateCard = ({
  template,
  variationsCount = 0,
  onEdit,
  onDelete,
  onPreview,
  onToggleActive,
  onManageVariations
}: TemplateCardProps) => {
  const truncatedContent = template.content.length > 150 
    ? template.content.substring(0, 150) + '...' 
    : template.content;

  return (
    <Card className={`bg-card border-border transition-all hover:shadow-lg ${!template.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium text-foreground">
              {template.name}
            </CardTitle>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(template)}>
                <Eye className="h-4 w-4 mr-2" />
                Pré-visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(template.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge 
            variant="outline" 
            className={CATEGORY_COLORS[template.category]}
          >
            {CATEGORY_LABELS[template.category]}
          </Badge>
          
          {template.variables.length > 0 && (
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
              <Variable className="h-3 w-3 mr-1" />
              {template.variables.length} variáveis
            </Badge>
          )}
          
          {variationsCount > 0 && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <Sparkles className="h-3 w-3 mr-1" />
              {variationsCount} variações
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
            {truncatedContent}
          </p>
        </div>

        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <Badge 
                key={v} 
                variant="secondary" 
                className="text-xs bg-primary/10 text-primary border-primary/20"
              >
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}

        {/* Variations button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => onManageVariations(template)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {variationsCount > 0 ? `Gerenciar ${variationsCount} Variações` : 'Gerar Variações com IA'}
        </Button>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Switch
              checked={template.is_active}
              onCheckedChange={(checked) => onToggleActive(template.id, checked)}
              className="scale-90"
            />
            <span className="text-xs text-muted-foreground">
              {template.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          <span className="text-xs text-muted-foreground">
            Atualizado {format(new Date(template.updated_at), "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
