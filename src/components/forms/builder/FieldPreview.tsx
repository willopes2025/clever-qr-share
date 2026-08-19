import { FormField } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Minus, CalendarCheck, Clock } from "lucide-react";

interface FieldPreviewProps {
  field: FormField;
}

export const FieldPreview = ({ field }: FieldPreviewProps) => {
  const renderField = () => {
    switch (field.field_type) {
      case 'short_text':
      case 'email':
      case 'phone':
      case 'number':
      case 'url':
        return (
          <Input
            placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
            disabled
            className="bg-muted/50"
          />
        );

      case 'long_text':
        return (
          <Textarea
            placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
            disabled
            className="bg-muted/50 min-h-[80px]"
          />
        );

      case 'date':
        return (
          <Input type="date" disabled className="bg-muted/50" />
        );

      case 'time':
        return (
          <Input type="time" disabled className="bg-muted/50" />
        );

      case 'datetime':
        return (
          <Input type="datetime-local" disabled className="bg-muted/50" />
        );

      case 'select':
        return (
          <Select disabled>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder={field.placeholder || "Selecione..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select':
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox disabled />
                <span className="text-sm">{opt.label}</span>
              </div>
            ))}
          </div>
        );

      case 'radio':
        return (
          <RadioGroup disabled className="space-y-2">
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} disabled />
                <span className="text-sm">{opt.label}</span>
              </div>
            ))}
          </RadioGroup>
        );

      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-6 w-6 text-muted-foreground" />
            ))}
          </div>
        );

      case 'scheduling':
        return (
          <div className="space-y-3">
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Calendário de Agendamento</span>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-3">
                {['D','S','T','Q','Q','S','S'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: 14 }, (_, i) => (
                  <div key={i} className={`text-center text-xs py-1 rounded ${i === 5 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {['09:00', '10:00', '11:00'].map(t => (
                  <div key={t} className="text-xs px-2 py-1 border rounded bg-background flex items-center gap-1">
                    <Clock className="h-3 w-3" />{t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'product_table': {
        const products: Array<{ id?: string; name?: string; unit?: string; price?: number }> =
          (field.settings as any)?.products || [];
        const showPrices = (field.settings as any)?.show_prices !== false;
        return (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Produto</th>
                  {showPrices && <th className="text-right p-2 font-medium">Preço</th>}
                  <th className="text-right p-2 font-medium w-24">Qtd.</th>
                  {showPrices && <th className="text-right p-2 font-medium">Subtotal</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-muted-foreground text-xs">
                      Nenhum produto cadastrado
                    </td>
                  </tr>
                )}
                {products.map((p, i) => (
                  <tr key={p.id || i} className="border-t">
                    <td className="p-2">
                      {p.name}
                      {p.unit ? <span className="text-muted-foreground"> ({p.unit})</span> : null}
                    </td>
                    {showPrices && (
                      <td className="p-2 text-right">
                        R$ {(p.price || 0).toFixed(2).replace('.', ',')}
                      </td>
                    )}
                    <td className="p-2 text-right">
                      <Input type="number" disabled className="h-8 bg-muted/50 text-right" placeholder="0" />
                    </td>
                    {showPrices && <td className="p-2 text-right text-muted-foreground">R$ 0,00</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="p-2 font-medium" colSpan={showPrices ? 3 : 2}>
                    Total
                  </td>
                  <td className="p-2 text-right font-semibold">R$ 0,00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }

      case 'name':
        return (
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nome" disabled className="bg-muted/50" />
            <Input placeholder="Sobrenome" disabled className="bg-muted/50" />
          </div>
        );

      case 'address':
        return (
          <div className="space-y-3">
            <Input placeholder="Rua" disabled className="bg-muted/50" />
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Número" disabled className="bg-muted/50" />
              <Input placeholder="Complemento" disabled className="bg-muted/50" />
              <Input placeholder="CEP" disabled className="bg-muted/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Cidade" disabled className="bg-muted/50" />
              <Input placeholder="Estado" disabled className="bg-muted/50" />
            </div>
          </div>
        );

      case 'district':
        return (
          <Select disabled>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder={field.placeholder || "Selecione o distrito..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder">Carregado via API do IBGE</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'file':
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Clique ou arraste arquivos aqui
            </p>
          </div>
        );

      case 'hidden':
        return (
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Campo oculto (não visível para o usuário)</p>
          </div>
        );

      case 'heading':
        return (
          <h2 className="text-xl font-semibold">{field.label}</h2>
        );

      case 'paragraph':
        return (
          <p className="text-muted-foreground">{field.help_text || field.label}</p>
        );

      case 'divider':
        return (
          <div className="flex items-center gap-2">
            <Minus className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 border-t" />
            <Minus className="h-4 w-4 text-muted-foreground" />
          </div>
        );

      default:
        return (
          <Input placeholder={field.placeholder || ""} disabled className="bg-muted/50" />
        );
    }
  };

  // Layout fields don't have labels
  if (['heading', 'paragraph', 'divider'].includes(field.field_type)) {
    return renderField();
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField()}
      {field.help_text && !['heading', 'paragraph'].includes(field.field_type) && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}
    </div>
  );
};
