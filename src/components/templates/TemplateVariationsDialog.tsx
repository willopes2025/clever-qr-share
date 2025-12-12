import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { useTemplateVariations, TemplateVariation } from '@/hooks/useTemplateVariations';
import { MessageTemplate } from '@/hooks/useMessageTemplates';
import { Badge } from '@/components/ui/badge';

interface TemplateVariationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MessageTemplate | null;
}

export const TemplateVariationsDialog = ({ 
  open, 
  onOpenChange, 
  template 
}: TemplateVariationsDialogProps) => {
  const [variationCount, setVariationCount] = useState('5');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { 
    variations, 
    isLoading, 
    generateVariations, 
    deleteVariation, 
    deleteAllVariations,
    updateVariation,
    isGenerating,
    isDeleting,
    isUpdating
  } = useTemplateVariations(template?.id);

  const handleGenerate = () => {
    if (!template) return;
    generateVariations({
      templateId: template.id,
      content: template.content,
      variationCount: parseInt(variationCount)
    });
  };

  const handleEdit = (variation: TemplateVariation) => {
    setEditingId(variation.id);
    setEditContent(variation.content);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateVariation({ variationId: editingId, content: editContent });
    setEditingId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Variações do Template
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template.name}
          </p>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Original message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Mensagem Original</label>
            <div className="p-3 bg-muted/50 rounded-lg text-sm border border-border">
              {template.content}
            </div>
          </div>

          {/* Generate controls */}
          <div className="flex items-center gap-3">
            <Select value={variationCount} onValueChange={setVariationCount}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 variações</SelectItem>
                <SelectItem value="5">5 variações</SelectItem>
                <SelectItem value="8">8 variações</SelectItem>
                <SelectItem value="10">10 variações</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {variations.length > 0 ? 'Regenerar Variações' : 'Gerar Variações'}
                </>
              )}
            </Button>

            {variations.length > 0 && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => template && deleteAllVariations(template.id)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>

          {/* Variations list */}
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">
                Variações Geradas
              </label>
              {variations.length > 0 && (
                <Badge variant="secondary">{variations.length} variações</Badge>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : variations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma variação gerada ainda.</p>
                <p className="text-sm">Clique em "Gerar Variações" para criar alternativas.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {variations.map((variation) => (
                    <div 
                      key={variation.id} 
                      className="p-3 bg-muted/30 rounded-lg border border-border group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          Variação {variation.variation_index}
                        </Badge>
                        
                        {editingId !== variation.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => handleEdit(variation)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={() => deleteVariation(variation.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {editingId === variation.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[80px] text-sm"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Cancelar
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={isUpdating}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Salvar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {variation.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <strong>💡 Dica:</strong> As variações serão usadas automaticamente nas campanhas. 
            Cada contato receberá uma versão diferente da mensagem de forma aleatória, 
            ajudando a evitar detecção de spam.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
