import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAsaas } from "@/hooks/useAsaas";
import { Loader2 } from "lucide-react";

interface AsaasPaymentLinkFormProps {
  onClose: () => void;
}

export const AsaasPaymentLinkForm = ({ onClose }: AsaasPaymentLinkFormProps) => {
  const { createPaymentLink } = useAsaas();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    value: "",
    billingType: "UNDEFINED",
    hasFixedValue: false,
  });

  const isLoading = createPaymentLink.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createPaymentLink.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      value: formData.hasFixedValue && formData.value ? parseFloat(formData.value) : undefined,
      billingType: formData.billingType !== "UNDEFINED" ? formData.billingType : undefined,
    });
    
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Link de Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Link *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Produto XYZ"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do produto ou serviço..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="hasFixedValue">Valor Fixo</Label>
            <Switch
              id="hasFixedValue"
              checked={formData.hasFixedValue}
              onCheckedChange={(checked) => setFormData({ ...formData, hasFixedValue: checked })}
            />
          </div>

          {formData.hasFixedValue && (
            <div className="space-y-2">
              <Label htmlFor="value">Valor</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="0,00"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="billingType">Forma de Pagamento</Label>
            <Select
              value={formData.billingType}
              onValueChange={(value) => setFormData({ ...formData, billingType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNDEFINED">Todas</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
