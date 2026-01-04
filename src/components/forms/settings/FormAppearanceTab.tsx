import { Form, useForms } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormAppearanceTabProps {
  form: Form;
}

const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
];

export const FormAppearanceTab = ({ form }: FormAppearanceTabProps) => {
  const { updateForm } = useForms();
  const [appearance, setAppearance] = useState({
    page_title: form.page_title || '',
    header_text: form.header_text || '',
    subheader_text: form.subheader_text || '',
    logo_url: form.logo_url || '',
    background_color: form.background_color,
    primary_color: form.primary_color,
    font_family: form.font_family,
    meta_description: form.meta_description || '',
    og_image_url: form.og_image_url || '',
  });

  useEffect(() => {
    setAppearance({
      page_title: form.page_title || '',
      header_text: form.header_text || '',
      subheader_text: form.subheader_text || '',
      logo_url: form.logo_url || '',
      background_color: form.background_color,
      primary_color: form.primary_color,
      font_family: form.font_family,
      meta_description: form.meta_description || '',
      og_image_url: form.og_image_url || '',
    });
  }, [form]);

  const handleSave = () => {
    updateForm.mutate({
      id: form.id,
      page_title: appearance.page_title || null,
      header_text: appearance.header_text || null,
      subheader_text: appearance.subheader_text || null,
      logo_url: appearance.logo_url || null,
      background_color: appearance.background_color,
      primary_color: appearance.primary_color,
      font_family: appearance.font_family,
      meta_description: appearance.meta_description || null,
      og_image_url: appearance.og_image_url || null,
    });
  };

  const hasChanges = JSON.stringify(appearance) !== JSON.stringify({
    page_title: form.page_title || '',
    header_text: form.header_text || '',
    subheader_text: form.subheader_text || '',
    logo_url: form.logo_url || '',
    background_color: form.background_color,
    primary_color: form.primary_color,
    font_family: form.font_family,
    meta_description: form.meta_description || '',
    og_image_url: form.og_image_url || '',
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cabeçalho</CardTitle>
          <CardDescription>
            Configure o título e logo que aparecem no topo do formulário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo_url">URL do Logo</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://..."
              value={appearance.logo_url}
              onChange={(e) => setAppearance({ ...appearance, logo_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="header_text">Título Principal</Label>
            <Input
              id="header_text"
              value={appearance.header_text}
              onChange={(e) => setAppearance({ ...appearance, header_text: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subheader_text">Subtítulo</Label>
            <Textarea
              id="subheader_text"
              value={appearance.subheader_text}
              onChange={(e) => setAppearance({ ...appearance, subheader_text: e.target.value })}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cores e Estilo</CardTitle>
          <CardDescription>
            Personalize as cores e a fonte do formulário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={appearance.primary_color}
                  onChange={(e) => setAppearance({ ...appearance, primary_color: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={appearance.primary_color}
                  onChange={(e) => setAppearance({ ...appearance, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background_color">Cor de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  id="background_color"
                  type="color"
                  value={appearance.background_color}
                  onChange={(e) => setAppearance({ ...appearance, background_color: e.target.value })}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={appearance.background_color}
                  onChange={(e) => setAppearance({ ...appearance, background_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fonte</Label>
            <Select
              value={appearance.font_family}
              onValueChange={(value) => setAppearance({ ...appearance, font_family: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO e Compartilhamento</CardTitle>
          <CardDescription>
            Configure como o formulário aparece nos buscadores e redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page_title">Título da Página (SEO)</Label>
            <Input
              id="page_title"
              value={appearance.page_title}
              onChange={(e) => setAppearance({ ...appearance, page_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_description">Descrição (Meta Description)</Label>
            <Textarea
              id="meta_description"
              value={appearance.meta_description}
              onChange={(e) => setAppearance({ ...appearance, meta_description: e.target.value })}
              rows={2}
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">
              {appearance.meta_description.length}/160 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_image_url">Imagem de Compartilhamento (OG Image)</Label>
            <Input
              id="og_image_url"
              type="url"
              placeholder="https://..."
              value={appearance.og_image_url}
              onChange={(e) => setAppearance({ ...appearance, og_image_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Imagem exibida ao compartilhar o formulário nas redes sociais
            </p>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateForm.isPending}>
            {updateForm.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      )}
    </div>
  );
};
