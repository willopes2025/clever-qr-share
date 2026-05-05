import { Form } from "@/hooks/useForms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FormShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form;
  onUpdateForm?: (updates: Partial<Form>) => void;
}

interface StaticParam {
  key: string;
  value: string;
}

const SUGGESTED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'origem',
  'vendedor',
  'campanha',
  'produto',
];

export const FormShareDialog = ({ open, onOpenChange, form, onUpdateForm }: FormShareDialogProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [staticParams, setStaticParams] = useState<StaticParam[]>(
    Array.isArray(form.url_static_params) ? form.url_static_params : []
  );
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  // Build URL with static params
  const buildFormUrl = () => {
    const baseUrl = `${window.location.origin}/form/${form.slug}`;
    if (staticParams.length === 0) return baseUrl;
    
    const paramsPath = staticParams
      .filter(p => p.key && p.value)
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('/');
    
    return paramsPath ? `${baseUrl}/${paramsPath}` : baseUrl;
  };

  const formUrl = buildFormUrl();
  const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0" style="border: none;"></iframe>`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(null), 2000);
  };

  const addParam = () => {
    if (!newParamKey.trim()) {
      toast.error("Digite uma chave para o parâmetro");
      return;
    }
    
    const newParams = [...staticParams, { key: newParamKey.trim(), value: newParamValue.trim() }];
    setStaticParams(newParams);
    setNewParamKey('');
    setNewParamValue('');
    
    // Save to database
    if (onUpdateForm) {
      onUpdateForm({ url_static_params: newParams });
    }
  };

  const removeParam = (index: number) => {
    const newParams = staticParams.filter((_, i) => i !== index);
    setStaticParams(newParams);
    
    // Save to database
    if (onUpdateForm) {
      onUpdateForm({ url_static_params: newParams });
    }
  };

  const updateParam = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...staticParams];
    newParams[index] = { ...newParams[index], [field]: value };
    setStaticParams(newParams);
    
    // Save to database
    if (onUpdateForm) {
      onUpdateForm({ url_static_params: newParams });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar Formulário</DialogTitle>
          <DialogDescription>
            Compartilhe o link do seu formulário ou incorpore-o em seu site
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Static URL Parameters */}
          <div className="space-y-3">
            <Label>Parâmetros Estáticos da URL</Label>
            <p className="text-xs text-muted-foreground">
              Adicione parâmetros que serão incluídos na URL e salvos com cada submissão (útil para rastreamento)
            </p>
            
            {/* Existing params */}
            {staticParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={param.key}
                  onChange={(e) => updateParam(index, 'key', e.target.value)}
                  placeholder="Chave"
                  className="flex-1"
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  value={param.value}
                  onChange={(e) => updateParam(index, 'value', e.target.value)}
                  placeholder="Valor"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeParam(index)}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add new param */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Input
                  value={newParamKey}
                  onChange={(e) => setNewParamKey(e.target.value)}
                  placeholder="Chave (ex: utm_source)"
                  list="suggested-params"
                />
                <datalist id="suggested-params">
                  {SUGGESTED_PARAMS.map(param => (
                    <option key={param} value={param} />
                  ))}
                </datalist>
              </div>
              <span className="text-muted-foreground">=</span>
              <Input
                value={newParamValue}
                onChange={(e) => setNewParamValue(e.target.value)}
                placeholder="Valor"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addParam();
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addParam}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Direct Link */}
          <div className="space-y-2">
            <Label>Link Gerado</Label>
            <div className="flex gap-2">
              <Input value={formUrl} readOnly className="flex-1 font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(formUrl, 'link')}
              >
                {copied === 'link' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(formUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Embed Code */}
          <div className="space-y-2">
            <Label>Código de Incorporação (Iframe)</Label>
            <div className="flex gap-2">
              <Textarea
                value={embedCode}
                readOnly
                rows={3}
                className="flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => handleCopy(embedCode, 'embed')}
              >
                {copied === 'embed' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole este código no HTML do seu site para incorporar o formulário
            </p>
          </div>

          {/* Status Warning */}
          {form.status !== 'published' && (
            <div className="bg-amber-500/10 text-amber-600 rounded-lg p-3 text-sm">
              <p>
                <strong>Atenção:</strong> Este formulário ainda não foi publicado.
                Os visitantes verão uma mensagem de erro ao acessar o link.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
