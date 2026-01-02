import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAsaas } from "@/hooks/useAsaas";
import { Loader2, ChevronDown, ChevronUp, CreditCard, Percent, Clock, Info } from "lucide-react";
import { format, addDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AsaasPaymentFormProps {
  onClose: () => void;
}

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
type DiscountType = "FIXED" | "PERCENTAGE";
type FineType = "FIXED" | "PERCENTAGE";

interface PaymentFormData {
  // Campos básicos
  customer: string;
  billingType: BillingType;
  value: string;
  dueDate: string;
  description: string;
  externalReference: string;
  
  // Parcelamento
  installmentCount: number;
  
  // Desconto
  discountEnabled: boolean;
  discountValue: string;
  discountType: DiscountType;
  discountDueDateLimitDays: string;
  
  // Multa
  fineEnabled: boolean;
  fineValue: string;
  fineType: FineType;
  
  // Juros
  interestEnabled: boolean;
  interestValue: string;
  
  // Opções extras
  postalService: boolean;
  canBePaidAfterDueDate: boolean;
  daysAfterDueDateToRegistrationCancellation: string;
  
  // Cartão de crédito
  creditCardHolderName: string;
  creditCardNumber: string;
  creditCardExpiryMonth: string;
  creditCardExpiryYear: string;
  creditCardCcv: string;
  creditCardHolderInfoName: string;
  creditCardHolderInfoEmail: string;
  creditCardHolderInfoCpfCnpj: string;
  creditCardHolderInfoPostalCode: string;
  creditCardHolderInfoAddressNumber: string;
  creditCardHolderInfoPhone: string;
  authorizeOnly: boolean;
}

const initialFormData: PaymentFormData = {
  customer: "",
  billingType: "PIX",
  value: "",
  dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
  description: "",
  externalReference: "",
  
  installmentCount: 1,
  
  discountEnabled: false,
  discountValue: "",
  discountType: "FIXED",
  discountDueDateLimitDays: "0",
  
  fineEnabled: false,
  fineValue: "",
  fineType: "PERCENTAGE",
  
  interestEnabled: false,
  interestValue: "",
  
  postalService: false,
  canBePaidAfterDueDate: true,
  daysAfterDueDateToRegistrationCancellation: "",
  
  creditCardHolderName: "",
  creditCardNumber: "",
  creditCardExpiryMonth: "",
  creditCardExpiryYear: "",
  creditCardCcv: "",
  creditCardHolderInfoName: "",
  creditCardHolderInfoEmail: "",
  creditCardHolderInfoCpfCnpj: "",
  creditCardHolderInfoPostalCode: "",
  creditCardHolderInfoAddressNumber: "",
  creditCardHolderInfoPhone: "",
  authorizeOnly: false,
};

export const AsaasPaymentForm = ({ onClose }: AsaasPaymentFormProps) => {
  const { createPayment, customers } = useAsaas();
  const [formData, setFormData] = useState<PaymentFormData>(initialFormData);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isLoading = createPayment.isPending;
  const showInstallments = formData.billingType === "BOLETO" || formData.billingType === "CREDIT_CARD";
  const showCreditCardFields = formData.billingType === "CREDIT_CARD";
  const showPostalService = formData.billingType === "BOLETO";

  const updateField = <K extends keyof PaymentFormData>(field: K, value: PaymentFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateInstallmentValue = () => {
    const total = parseFloat(formData.value) || 0;
    if (formData.installmentCount > 1) {
      return (total / formData.installmentCount).toFixed(2);
    }
    return total.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentData = {
      customer: formData.customer,
      billingType: formData.billingType as "PIX" | "BOLETO" | "CREDIT_CARD",
      value: parseFloat(formData.value),
      dueDate: formData.dueDate,
      description: formData.description || undefined,
      externalReference: formData.externalReference || undefined,
      canBePaidAfterDueDate: formData.canBePaidAfterDueDate,
    } as Parameters<typeof createPayment.mutateAsync>[0];

    // Parcelamento
    if (showInstallments && formData.installmentCount > 1) {
      paymentData.installmentCount = formData.installmentCount;
      paymentData.installmentValue = parseFloat(calculateInstallmentValue());
    }

    // Desconto
    if (formData.discountEnabled && formData.discountValue) {
      paymentData.discount = {
        value: parseFloat(formData.discountValue),
        type: formData.discountType,
        dueDateLimitDays: parseInt(formData.discountDueDateLimitDays) || 0,
      };
    }

    // Multa
    if (formData.fineEnabled && formData.fineValue) {
      paymentData.fine = {
        value: parseFloat(formData.fineValue),
        type: formData.fineType,
      };
    }

    // Juros
    if (formData.interestEnabled && formData.interestValue) {
      paymentData.interest = {
        value: parseFloat(formData.interestValue),
      };
    }

    // Boleto específico
    if (formData.billingType === "BOLETO") {
      if (formData.postalService) {
        paymentData.postalService = true;
      }
      if (formData.daysAfterDueDateToRegistrationCancellation) {
        paymentData.daysAfterDueDateToRegistrationCancellation = parseInt(formData.daysAfterDueDateToRegistrationCancellation);
      }
    }

    // Cartão de crédito
    if (formData.billingType === "CREDIT_CARD") {
      if (formData.creditCardNumber) {
        paymentData.creditCard = {
          holderName: formData.creditCardHolderName,
          number: formData.creditCardNumber.replace(/\s/g, ""),
          expiryMonth: formData.creditCardExpiryMonth,
          expiryYear: formData.creditCardExpiryYear,
          ccv: formData.creditCardCcv,
        };
        paymentData.creditCardHolderInfo = {
          name: formData.creditCardHolderInfoName,
          email: formData.creditCardHolderInfoEmail,
          cpfCnpj: formData.creditCardHolderInfoCpfCnpj.replace(/[^\d]/g, ""),
          postalCode: formData.creditCardHolderInfoPostalCode.replace(/[^\d]/g, ""),
          addressNumber: formData.creditCardHolderInfoAddressNumber,
          phone: formData.creditCardHolderInfoPhone.replace(/[^\d]/g, ""),
        };
      }
      if (formData.authorizeOnly) {
        paymentData.authorizeOnly = true;
      }
    }
    
    await createPayment.mutateAsync(paymentData);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campos Básicos */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente *</Label>
                <Select
                  value={formData.customer}
                  onValueChange={(value) => updateField("customer", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.cpfCnpj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingType">Forma de Pagamento *</Label>
                  <Select
                    value={formData.billingType}
                    onValueChange={(value) => updateField("billingType", value as BillingType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto Bancário</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                      <SelectItem value="UNDEFINED">Cliente escolhe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Valor Total *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.value}
                      onChange={(e) => updateField("value", e.target.value)}
                      placeholder="0,00"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Vencimento *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => updateField("dueDate", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="externalReference">Referência Externa</Label>
                  <Input
                    id="externalReference"
                    value={formData.externalReference}
                    onChange={(e) => updateField("externalReference", e.target.value)}
                    placeholder="ID do pedido, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Descrição da cobrança..."
                  rows={2}
                />
              </div>
            </div>

            {/* Parcelamento */}
            {showInstallments && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Parcelamento</Label>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Número de parcelas</span>
                    <span className="text-sm font-medium">{formData.installmentCount}x</span>
                  </div>
                  <Slider
                    value={[formData.installmentCount]}
                    onValueChange={([value]) => updateField("installmentCount", value)}
                    min={1}
                    max={21}
                    step={1}
                  />
                  {formData.installmentCount > 1 && (
                    <p className="text-sm text-muted-foreground">
                      {formData.installmentCount}x de R$ {calculateInstallmentValue()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Opções Avançadas */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between">
                  <span>Opções Avançadas</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <Tabs defaultValue="discount" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="discount" className="text-xs">
                      <Percent className="h-3 w-3 mr-1" />
                      Desconto
                    </TabsTrigger>
                    <TabsTrigger value="fine" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Multa/Juros
                    </TabsTrigger>
                    <TabsTrigger value="extra" className="text-xs">
                      <Info className="h-3 w-3 mr-1" />
                      Extras
                    </TabsTrigger>
                  </TabsList>

                  {/* Desconto */}
                  <TabsContent value="discount" className="space-y-4 pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="discountEnabled"
                        checked={formData.discountEnabled}
                        onCheckedChange={(checked) => updateField("discountEnabled", !!checked)}
                      />
                      <Label htmlFor="discountEnabled">Aplicar desconto para pagamento antecipado</Label>
                    </div>
                    
                    {formData.discountEnabled && (
                      <div className="grid grid-cols-3 gap-3 pl-6">
                        <div className="space-y-2">
                          <Label className="text-xs">Valor</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.discountValue}
                            onChange={(e) => updateField("discountValue", e.target.value)}
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={formData.discountType}
                            onValueChange={(value) => updateField("discountType", value as DiscountType)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">R$ Fixo</SelectItem>
                              <SelectItem value="PERCENTAGE">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Label className="text-xs flex items-center gap-1">
                                  Dias antes <Info className="h-3 w-3" />
                                </Label>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Número de dias antes do vencimento</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Input
                            type="number"
                            min="0"
                            value={formData.discountDueDateLimitDays}
                            onChange={(e) => updateField("discountDueDateLimitDays", e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Multa e Juros */}
                  <TabsContent value="fine" className="space-y-4 pt-4">
                    {/* Multa */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="fineEnabled"
                          checked={formData.fineEnabled}
                          onCheckedChange={(checked) => updateField("fineEnabled", !!checked)}
                        />
                        <Label htmlFor="fineEnabled">Aplicar multa por atraso</Label>
                      </div>
                      
                      {formData.fineEnabled && (
                        <div className="grid grid-cols-2 gap-3 pl-6">
                          <div className="space-y-2">
                            <Label className="text-xs">Valor da Multa</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={formData.fineType === "PERCENTAGE" ? "10" : undefined}
                              value={formData.fineValue}
                              onChange={(e) => updateField("fineValue", e.target.value)}
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Tipo</Label>
                            <Select
                              value={formData.fineType}
                              onValueChange={(value) => updateField("fineType", value as FineType)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FIXED">R$ Fixo</SelectItem>
                                <SelectItem value="PERCENTAGE">% (máx 10%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Juros */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="interestEnabled"
                          checked={formData.interestEnabled}
                          onCheckedChange={(checked) => updateField("interestEnabled", !!checked)}
                        />
                        <Label htmlFor="interestEnabled">Aplicar juros por atraso</Label>
                      </div>
                      
                      {formData.interestEnabled && (
                        <div className="pl-6 max-w-[200px]">
                          <div className="space-y-2">
                            <Label className="text-xs">% ao mês</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="10"
                              value={formData.interestValue}
                              onChange={(e) => updateField("interestValue", e.target.value)}
                              placeholder="0,00"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Opções Extras */}
                  <TabsContent value="extra" className="space-y-4 pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="canBePaidAfterDueDate"
                        checked={formData.canBePaidAfterDueDate}
                        onCheckedChange={(checked) => updateField("canBePaidAfterDueDate", !!checked)}
                      />
                      <Label htmlFor="canBePaidAfterDueDate">Permitir pagamento após vencimento</Label>
                    </div>

                    {showPostalService && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="postalService"
                            checked={formData.postalService}
                            onCheckedChange={(checked) => updateField("postalService", !!checked)}
                          />
                          <Label htmlFor="postalService">Enviar boleto pelos Correios</Label>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Dias após vencimento para cancelamento</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.daysAfterDueDateToRegistrationCancellation}
                            onChange={(e) => updateField("daysAfterDueDateToRegistrationCancellation", e.target.value)}
                            placeholder="Deixe vazio para não cancelar"
                            className="max-w-[300px]"
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CollapsibleContent>
            </Collapsible>

            {/* Dados do Cartão de Crédito */}
            {showCreditCardFields && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Dados do Cartão</Label>
                  <span className="text-xs text-muted-foreground">(opcional - cliente pode preencher)</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome no Cartão</Label>
                    <Input
                      value={formData.creditCardHolderName}
                      onChange={(e) => updateField("creditCardHolderName", e.target.value.toUpperCase())}
                      placeholder="NOME COMO NO CARTÃO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Número do Cartão</Label>
                    <Input
                      value={formData.creditCardNumber}
                      onChange={(e) => updateField("creditCardNumber", e.target.value)}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Mês</Label>
                    <Input
                      value={formData.creditCardExpiryMonth}
                      onChange={(e) => updateField("creditCardExpiryMonth", e.target.value)}
                      placeholder="MM"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ano</Label>
                    <Input
                      value={formData.creditCardExpiryYear}
                      onChange={(e) => updateField("creditCardExpiryYear", e.target.value)}
                      placeholder="AAAA"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">CVV</Label>
                    <Input
                      value={formData.creditCardCcv}
                      onChange={(e) => updateField("creditCardCcv", e.target.value)}
                      placeholder="123"
                      maxLength={4}
                      type="password"
                    />
                  </div>
                </div>

                {formData.creditCardNumber && (
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-sm font-medium">Dados do Titular</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Nome Completo</Label>
                        <Input
                          value={formData.creditCardHolderInfoName}
                          onChange={(e) => updateField("creditCardHolderInfoName", e.target.value)}
                          placeholder="Nome do titular"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">E-mail</Label>
                        <Input
                          type="email"
                          value={formData.creditCardHolderInfoEmail}
                          onChange={(e) => updateField("creditCardHolderInfoEmail", e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">CPF/CNPJ</Label>
                        <Input
                          value={formData.creditCardHolderInfoCpfCnpj}
                          onChange={(e) => updateField("creditCardHolderInfoCpfCnpj", e.target.value)}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Telefone</Label>
                        <Input
                          value={formData.creditCardHolderInfoPhone}
                          onChange={(e) => updateField("creditCardHolderInfoPhone", e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">CEP</Label>
                        <Input
                          value={formData.creditCardHolderInfoPostalCode}
                          onChange={(e) => updateField("creditCardHolderInfoPostalCode", e.target.value)}
                          placeholder="00000-000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Número do Endereço</Label>
                        <Input
                          value={formData.creditCardHolderInfoAddressNumber}
                          onChange={(e) => updateField("creditCardHolderInfoAddressNumber", e.target.value)}
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="authorizeOnly"
                    checked={formData.authorizeOnly}
                    onCheckedChange={(checked) => updateField("authorizeOnly", !!checked)}
                  />
                  <Label htmlFor="authorizeOnly" className="text-sm">
                    Apenas pré-autorizar (reservar valor sem cobrar)
                  </Label>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !formData.customer || !formData.value}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Cobrança
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
