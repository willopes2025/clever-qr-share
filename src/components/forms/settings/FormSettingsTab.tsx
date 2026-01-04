import { Form, useForms } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface FormSettingsTabProps {
  form: Form;
}

export const FormSettingsTab = ({ form }: FormSettingsTabProps) => {
  const { updateForm } = useForms();
  const [settings, setSettings] = useState({
    name: form.name,
    description: form.description || '',
    slug: form.slug,
    success_message: form.success_message,
    redirect_url: form.redirect_url || '',
    submit_button_text: form.submit_button_text,
  });

  useEffect(() => {
    setSettings({
      name: form.name,
      description: form.description || '',
      slug: form.slug,
      success_message: form.success_message,
      redirect_url: form.redirect_url || '',
      submit_button_text: form.submit_button_text,
    });
  }, [form]);

  const handleSave = () => {
    updateForm.mutate({
      id: form.id,
      name: settings.name,
      description: settings.description || null,
      slug: settings.slug,
      success_message: settings.success_message,
      redirect_url: settings.redirect_url || null,
      submit_button_text: settings.submit_button_text,
    });
  };

  const hasChanges = 
    settings.name !== form.name ||
    settings.description !== (form.description || '') ||
    settings.slug !== form.slug ||
    settings.success_message !== form.success_message ||
    settings.redirect_url !== (form.redirect_url || '') ||
    settings.submit_button_text !== form.submit_button_text;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>
            Configure o nome, URL e descrição do formulário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Formulário</Label>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL do Formulário</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input
                id="slug"
                value={settings.slug}
                onChange={(e) => setSettings({ ...settings, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={settings.description}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Após o Envio</CardTitle>
          <CardDescription>
            Configure o que acontece quando o usuário envia o formulário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="success_message">Mensagem de Sucesso</Label>
            <Textarea
              id="success_message"
              value={settings.success_message}
              onChange={(e) => setSettings({ ...settings, success_message: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="redirect_url">URL de Redirecionamento (opcional)</Label>
            <Input
              id="redirect_url"
              type="url"
              placeholder="https://..."
              value={settings.redirect_url}
              onChange={(e) => setSettings({ ...settings, redirect_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Se preenchido, o usuário será redirecionado para esta URL após enviar o formulário
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="submit_button_text">Texto do Botão de Envio</Label>
            <Input
              id="submit_button_text"
              value={settings.submit_button_text}
              onChange={(e) => setSettings({ ...settings, submit_button_text: e.target.value })}
            />
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
