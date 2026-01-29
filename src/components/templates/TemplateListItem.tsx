import { MessageTemplate, CATEGORY_LABELS, CATEGORY_COLORS } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Eye, Variable, FileText, Sparkles, Image, Video, Mic } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplateListItemProps {
  template: MessageTemplate;
  variationsCount?: number;
  onEdit: (template: MessageTemplate) => void;
  onDelete: (id: string) => void;
  onPreview: (template: MessageTemplate) => void;
  onToggleActive: (id: string, is_active: boolean) => void;
  onManageVariations: (template: MessageTemplate) => void;
}

export const TemplateListItem = ({
  template,
  variationsCount = 0,
  onEdit,
  onDelete,
  onPreview,
  onToggleActive,
  onManageVariations
}: TemplateListItemProps) => {
  const truncatedContent = template.content.length > 100 
    ? template.content.substring(0, 100) + '...' 
    : template.content;

  return (
    <div className={`flex items-center gap-4 p-4 bg-card border border-border rounded-lg transition-all hover:shadow-md ${!template.is_active ? 'opacity-60' : ''}`}>
      {/* Icon */}
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground truncate">{template.name}</h3>
          <Badge 
            variant="outline" 
            className={`text-xs ${CATEGORY_COLORS[template.category]}`}
          >
            {CATEGORY_LABELS[template.category]}
          </Badge>
          
          {template.media_type && (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
              {template.media_type === 'image' && <Image className="h-3 w-3 mr-1" />}
              {template.media_type === 'video' && <Video className="h-3 w-3 mr-1" />}
              {template.media_type === 'audio' && <Mic className="h-3 w-3 mr-1" />}
              {template.media_type === 'image' ? 'Imagem' : template.media_type === 'video' ? 'Vídeo' : 'Áudio'}
            </Badge>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground truncate">{truncatedContent}</p>
        
        <div className="flex items-center gap-2 flex-wrap">
          {template.variables.length > 0 && (
            <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-border">
              <Variable className="h-3 w-3 mr-1" />
              {template.variables.length} variáveis
            </Badge>
          )}
          
          {variationsCount > 0 && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              <Sparkles className="h-3 w-3 mr-1" />
              {variationsCount} variações
            </Badge>
          )}
          
          <span className="text-xs text-muted-foreground">
            Atualizado {format(new Date(template.updated_at), "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onManageVariations(template)}
          className="hidden sm:flex"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Variações
        </Button>

        <div className="flex items-center gap-2">
          <Switch
            checked={template.is_active}
            onCheckedChange={(checked) => onToggleActive(template.id, checked)}
            className="scale-90"
          />
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
            <DropdownMenuItem onClick={() => onManageVariations(template)} className="sm:hidden">
              <Sparkles className="h-4 w-4 mr-2" />
              Variações
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
    </div>
  );
};
