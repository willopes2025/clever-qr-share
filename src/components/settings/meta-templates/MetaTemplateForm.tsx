import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Send, Save, Eye } from "lucide-react";
import { CreateTemplateData } from "@/hooks/useMetaTemplates";

interface MetaTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { templateData: CreateTemplateData; submitToMeta: boolean }) => void;
  isSubmitting: boolean;
}

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing", description: "Promoções, ofertas, atualizações" },
  { value: "UTILITY", label: "Utilitário", description: "Confirmações, lembretes, atualizações de pedidos" },
  { value: "AUTHENTICATION", label: "Autenticação", description: "Códigos de verificação, OTP" },
];

const LANGUAGES = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Español" },
];

const HEADER_TYPES = [
  { value: "NONE", label: "Nenhum" },
  { value: "TEXT", label: "Texto" },
  { value: "IMAGE", label: "Imagem" },
  { value: "VIDEO", label: "Vídeo" },
  { value: "DOCUMENT", label: "Documento" },
];

const BUTTON_TYPES = [
  { value: "QUICK_REPLY", label: "Resposta Rápida" },
  { value: "URL", label: "Link (URL)" },
  { value: "PHONE_NUMBER", label: "Telefone" },
];

export function MetaTemplateForm({ open, onOpenChange, onSubmit, isSubmitting }: MetaTemplateFormProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<CreateTemplateData>({
    name: "",
    language: "pt_BR",
    category: "MARKETING",
    header_type: "NONE",
    header_content: "",
    header_example: "",
    body_text: "",
    body_examples: [],
    footer_text: "",
    buttons: [],
  });

  const handleChange = (field: keyof CreateTemplateData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addButton = () => {
    if ((formData.buttons?.length || 0) < 3) {
      handleChange("buttons", [
        ...(formData.buttons || []),
        { type: "QUICK_REPLY" as const, text: "" },
      ]);
    }
  };

  const removeButton = (index: number) => {
    const newButtons = [...(formData.buttons || [])];
    newButtons.splice(index, 1);
    handleChange("buttons", newButtons);
  };

  const updateButton = (index: number, field: string, value: string) => {
    const newButtons = [...(formData.buttons || [])];
    newButtons[index] = { ...newButtons[index], [field]: value };
    handleChange("buttons", newButtons);
  };

  // Extract variables from body text
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return [...new Set(matches)];
  };

  const variables = extractVariables(formData.body_text);

  const updateBodyExample = (index: number, value: string) => {
    const newExamples = [...(formData.body_examples || [])];
    newExamples[index] = value;
    handleChange("body_examples", newExamples);
  };

  const handleSubmit = (submitToMeta: boolean) => {
    // Validate
    if (!formData.name || !formData.body_text || !formData.category) {
      return;
    }

    // Ensure name is snake_case
    const sanitizedName = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_");

    onSubmit({
      templateData: {
        ...formData,
        name: sanitizedName,
      },
      submitToMeta,
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      language: "pt_BR",
      category: "MARKETING",
      header_type: "NONE",
      header_content: "",
      header_example: "",
      body_text: "",
      body_examples: [],
      footer_text: "",
      buttons: [],
    });
    setActiveTab("basic");
  };

  // Preview the template
  const renderPreview = () => {
    let previewBody = formData.body_text;
    (formData.body_examples || []).forEach((example, idx) => {
      previewBody = previewBody.replace(`{{${idx + 1}}}`, example || `{{${idx + 1}}}`);
    });

    return (
      <div className="bg-muted rounded-lg p-4 space-y-2">
        {formData.header_type === "TEXT" && formData.header_content && (
          <p className="font-semibold text-sm">{formData.header_content}</p>
        )}
        {formData.header_type && formData.header_type !== "TEXT" && formData.header_type !== "NONE" && (
          <div className="bg-background rounded h-32 flex items-center justify-center text-muted-foreground text-sm">
            [{formData.header_type}]
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{previewBody}</p>
        {formData.footer_text && (
          <p className="text-xs text-muted-foreground">{formData.footer_text}</p>
        )}
        {formData.buttons && formData.buttons.length > 0 && (
          <div className="flex flex-col gap-1 pt-2 border-t">
            {formData.buttons.map((btn, idx) => (
              <Button key={idx} variant="outline" size="sm" className="w-full" disabled>
                {btn.text || `Botão ${idx + 1}`}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Template Meta WhatsApp</DialogTitle>
          <DialogDescription>
            Crie um template para aprovação do Meta. Templates aprovados podem ser usados para iniciar conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="content">Conteúdo</TabsTrigger>
                <TabsTrigger value="buttons">Botões</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Template *</Label>
                  <Input
                    id="name"
                    placeholder="nome_do_template"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras minúsculas, números e underscores
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleChange("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div>
                            <span className="font-medium">{cat.label}</span>
                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => handleChange("language", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Cabeçalho</Label>
                  <Select
                    value={formData.header_type || "NONE"}
                    onValueChange={(value) => handleChange("header_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HEADER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {formData.header_type === "TEXT" && (
                    <div className="space-y-2 mt-2">
                      <Input
                        placeholder="Texto do cabeçalho"
                        value={formData.header_content || ""}
                        onChange={(e) => handleChange("header_content", e.target.value)}
                      />
                      <Input
                        placeholder="Exemplo do cabeçalho"
                        value={formData.header_example || ""}
                        onChange={(e) => handleChange("header_example", e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Corpo da Mensagem *</Label>
                  <Textarea
                    id="body"
                    placeholder="Olá {{1}}, sua compra {{2}} foi confirmada!"
                    value={formData.body_text}
                    onChange={(e) => handleChange("body_text", e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis
                  </p>
                </div>

                {variables.length > 0 && (
                  <div className="space-y-2">
                    <Label>Exemplos das Variáveis (obrigatório)</Label>
                    {variables.map((v, idx) => (
                      <div key={v} className="flex items-center gap-2">
                        <Badge variant="secondary">{v}</Badge>
                        <Input
                          placeholder={`Exemplo para ${v}`}
                          value={formData.body_examples?.[idx] || ""}
                          onChange={(e) => updateBodyExample(idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="footer">Rodapé (opcional)</Label>
                  <Input
                    id="footer"
                    placeholder="Texto do rodapé"
                    value={formData.footer_text || ""}
                    onChange={(e) => handleChange("footer_text", e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="buttons" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Botões (máx. 3)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addButton}
                    disabled={(formData.buttons?.length || 0) >= 3}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {formData.buttons?.map((button, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Botão {idx + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeButton(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <Select
                        value={button.type}
                        onValueChange={(value) => updateButton(idx, "type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUTTON_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Texto do botão"
                        value={button.text}
                        onChange={(e) => updateButton(idx, "text", e.target.value)}
                      />

                      {button.type === "URL" && (
                        <Input
                          placeholder="https://exemplo.com"
                          value={button.url || ""}
                          onChange={(e) => updateButton(idx, "url", e.target.value)}
                        />
                      )}

                      {button.type === "PHONE_NUMBER" && (
                        <Input
                          placeholder="+5511999999999"
                          value={button.phone_number || ""}
                          onChange={(e) => updateButton(idx, "phone_number", e.target.value)}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}

                {(!formData.buttons || formData.buttons.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum botão adicionado
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Pré-visualização
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderPreview()}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dicas</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Templates de <strong>Marketing</strong> precisam de opt-in do usuário</p>
                <p>• Templates <strong>Utilitários</strong> são para transações existentes</p>
                <p>• Aprovação pode levar de minutos a 24 horas</p>
                <p>• Variáveis devem ter exemplos realistas</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !formData.name || !formData.body_text}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || !formData.name || !formData.body_text}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Enviando..." : "Enviar para Aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
