import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, ChevronDown, ChevronUp, ChevronRight, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageTemplate, 
  CreateTemplateData, 
  TemplateCategory, 
  CATEGORY_LABELS,
  extractVariables,
  MediaType
} from '@/hooks/useMessageTemplates';
import { useCustomFields } from '@/hooks/useCustomFields';
import { VariableAutocomplete } from './VariableAutocomplete';
import { TemplateMediaUpload } from './TemplateMediaUpload';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onSubmit: (data: CreateTemplateData) => void;
  isLoading?: boolean;
}

const CATEGORY_PROMPTS: Record<TemplateCategory, string> = {
  promotional: 'Crie uma mensagem promocional oferecendo um desconto especial. Use o nome do cliente para personalizar e inclua um call-to-action.',
  welcome: 'Crie uma mensagem de boas-vindas calorosa para um novo cliente. Seja acolhedor e apresente brevemente os serviços.',
  reminder: 'Crie um lembrete amigável sobre um compromisso ou pagamento pendente. Seja educado e objetivo.',
  transactional: 'Crie uma confirmação de pedido ou transação com detalhes relevantes. Seja claro e profissional.',
  notification: 'Crie uma notificação informativa sobre uma atualização importante. Seja direto e informativo.',
  other: 'Crie uma mensagem personalizada para o contato. Seja natural e profissional.',
};

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

  // AI generation state (static one-shot)
  const [showAiSection, setShowAiSection] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Dynamic AI mode
  const [isDynamicAi, setIsDynamicAi] = useState(false);
  const [dynamicAiPrompt, setDynamicAiPrompt] = useState('');

  const { contactFieldDefinitions, leadFieldDefinitions } = useCustomFields();

  const staticVariables = [
    { key: 'nome', label: 'Nome do contato' },
    { key: 'telefone', label: 'Telefone do contato' },
    { key: 'email', label: 'Email do contato' },
  ];

  const contactCustomVariables = contactFieldDefinitions?.map(f => ({
    key: f.field_key,
    label: f.field_name,
  })) || [];

  const leadCustomVariables = leadFieldDefinitions?.map(f => ({
    key: f.field_key,
    label: f.field_name,
  })) || [];

  // All variables combined for AI generation
  const availableVariables = [
    ...staticVariables,
    ...contactCustomVariables,
    ...leadCustomVariables,
  ];

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setCategory(template.category);
      setIsActive(template.is_active);
      setMediaType(template.media_type || null);
      setMediaUrl(template.media_url || null);
      setMediaFilename(template.media_filename || null);
      setIsDynamicAi(!!template.ai_prompt);
      setDynamicAiPrompt(template.ai_prompt || '');
    } else {
      setName('');
      setContent('');
      setCategory('other');
      setIsActive(true);
      setMediaType(null);
      setMediaUrl(null);
      setMediaFilename(null);
      setIsDynamicAi(false);
      setDynamicAiPrompt('');
    }
    setShowAiSection(false);
    setAiPrompt('');
  }, [template, open]);

  useEffect(() => {
    setDetectedVariables(extractVariables(content));
  }, [content]);

  // Update AI prompt suggestion when category changes
  useEffect(() => {
    if (showAiSection && !aiPrompt) {
      setAiPrompt(CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other);
    }
  }, [category, showAiSection]);

  const handleToggleAiSection = () => {
    const next = !showAiSection;
    setShowAiSection(next);
    if (next && !aiPrompt) {
      setAiPrompt(CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.other);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite uma instrução para a IA');
      return;
    }

    if (content.trim()) {
      const confirmed = window.confirm('O conteúdo atual será substituído pelo gerado pela IA. Deseja continuar?');
      if (!confirmed) return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-template-content', {
        body: {
          prompt: aiPrompt,
          category,
          variables: availableVariables,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.content) {
        setContent(data.content);
        toast.success('Mensagem gerada com sucesso!');
        setShowAiSection(false);
      }
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(err.message || 'Erro ao gerar mensagem com IA');
    } finally {
      setIsGenerating(false);
    }
  };

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
            templateContent={content}
          />

          {/* AI Generation Section */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleAiSection}
              className="w-full justify-between border-primary/30 text-primary hover:bg-primary/10"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar com IA
              </span>
              {showAiSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showAiSection && (
              <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="space-y-1.5">
                  <Label className="text-xs">Instrução para a IA</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Descreva o tipo de mensagem que deseja gerar..."
                    rows={3}
                    className="bg-background border-border text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Variáveis disponíveis</Label>
                  
                  {/* Static contact fields - always visible */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Dados do Contato
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {staticVariables.map((v) => (
                        <Badge
                          key={v.key}
                          variant="secondary"
                          className="bg-primary/15 text-primary border-primary/25 text-[10px] cursor-pointer hover:bg-primary/25 px-1.5 py-0"
                          title={v.label}
                          onClick={() => setAiPrompt(prev => prev + ` {{${v.key}}}`)}
                        >
                          {`{{${v.key}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Contact custom fields - collapsible */}
                  {contactCustomVariables.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
                        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                        <FileText className="h-3 w-3" />
                        Campos de Contato ({contactCustomVariables.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-1">
                        <div className="flex flex-wrap gap-1">
                          {contactCustomVariables.map((v) => (
                            <Badge
                              key={v.key}
                              variant="secondary"
                              className="bg-secondary/60 text-secondary-foreground border-border text-[10px] cursor-pointer hover:bg-secondary px-1.5 py-0"
                              title={v.label}
                              onClick={() => setAiPrompt(prev => prev + ` {{${v.key}}}`)}
                            >
                              {`{{${v.key}}}`}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Lead custom fields - collapsible */}
                  {leadCustomVariables.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
                        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                        <FileText className="h-3 w-3" />
                        Campos de Lead ({leadCustomVariables.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-1">
                        <div className="flex flex-wrap gap-1">
                          {leadCustomVariables.map((v) => (
                            <Badge
                              key={v.key}
                              variant="secondary"
                              className="bg-accent/60 text-accent-foreground border-border text-[10px] cursor-pointer hover:bg-accent px-1.5 py-0"
                              title={v.label}
                              onClick={() => setAiPrompt(prev => prev + ` {{${v.key}}}`)}
                            >
                              {`{{${v.key}}}`}
                            </Badge>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Mensagem
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

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
