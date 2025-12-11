import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MessageTemplate, previewTemplate } from '@/hooks/useMessageTemplates';
import { Eye, Smartphone } from 'lucide-react';

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MessageTemplate | null;
}

const DEFAULT_SAMPLE_DATA: Record<string, string> = {
  nome: 'João Silva',
  telefone: '(11) 99999-9999',
  email: 'joao@exemplo.com',
  empresa: 'Empresa ABC',
  produto: 'Produto Premium',
  valor: 'R$ 199,90',
  data: '15/01/2025',
  link: 'https://exemplo.com'
};

export const TemplatePreviewDialog = ({
  open,
  onOpenChange,
  template
}: TemplatePreviewDialogProps) => {
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (template) {
      // Initialize sample data for detected variables
      const initialData: Record<string, string> = {};
      template.variables.forEach(v => {
        initialData[v] = DEFAULT_SAMPLE_DATA[v] || `[${v}]`;
      });
      setSampleData(initialData);
    }
  }, [template]);

  useEffect(() => {
    if (template) {
      setPreview(previewTemplate(template.content, sampleData));
    }
  }, [template, sampleData]);

  const updateSampleValue = (key: string, value: string) => {
    setSampleData(prev => ({ ...prev, [key]: value }));
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pré-visualização: {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Variables Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Valores das Variáveis</h3>
            
            {template.variables.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Este template não possui variáveis dinâmicas.
              </p>
            ) : (
              <div className="space-y-3">
                {template.variables.map((variable) => (
                  <div key={variable} className="space-y-1">
                    <Label htmlFor={variable} className="text-xs">
                      {`{{${variable}}}`}
                    </Label>
                    <Input
                      id={variable}
                      value={sampleData[variable] || ''}
                      onChange={(e) => updateSampleValue(variable, e.target.value)}
                      placeholder={`Valor para ${variable}`}
                      className="bg-background border-border text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Visualização da Mensagem
            </h3>
            
            <div className="bg-gradient-to-b from-emerald-900/30 to-emerald-950/50 rounded-2xl p-4 min-h-[200px] border border-emerald-500/20">
              {/* WhatsApp-like message bubble */}
              <div className="bg-emerald-800/40 rounded-lg p-3 max-w-[95%] ml-auto border border-emerald-500/20">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {preview}
                </p>
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    12:00 ✓✓
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Template Original</h4>
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                  {template.content}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
