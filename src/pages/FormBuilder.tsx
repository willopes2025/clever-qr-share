import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { useFormById, useFormFields, useForms } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, ExternalLink, Eye, Loader2, Settings, Palette, Share2, FileText, Webhook } from "lucide-react";
import { toast } from "sonner";
import { FieldPalette } from "@/components/forms/builder/FieldPalette";
import { FieldCanvas } from "@/components/forms/builder/FieldCanvas";
import { FieldProperties } from "@/components/forms/builder/FieldProperties";
import { FormSettingsTab } from "@/components/forms/settings/FormSettingsTab";
import { FormAppearanceTab } from "@/components/forms/settings/FormAppearanceTab";
import { FormShareDialog } from "@/components/forms/settings/FormShareDialog";
import { SubmissionsList } from "@/components/forms/submissions/SubmissionsList";

const FormBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: form, isLoading: formLoading } = useFormById(id);
  const { fields, isLoading: fieldsLoading, createField, updateField, deleteField, updateFieldsOrder } = useFormFields(id);
  const { updateForm } = useForms();
  
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("fields");

  const selectedField = fields?.find(f => f.id === selectedFieldId) || null;
  const isLoading = formLoading || fieldsLoading;

  const handlePublish = () => {
    if (!form) return;
    updateForm.mutate({
      id: form.id,
      status: form.status === 'published' ? 'draft' : 'published',
    });
  };

  const handlePreview = () => {
    if (!form) return;
    window.open(`/f/${form.slug}`, '_blank');
  };

  if (isLoading) {
    return (
      <AppLayout pageTitle="Formulário">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!form) {
    return (
      <AppLayout pageTitle="Formulário">
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-muted-foreground">Formulário não encontrado</p>
          <Button variant="link" onClick={() => navigate('/forms')}>
            Voltar para formulários
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Formulário">
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/forms')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold">{form.name}</h1>
              <p className="text-xs text-muted-foreground">/{form.slug}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
            <Button 
              size="sm" 
              onClick={handlePublish}
              variant={form.status === 'published' ? 'secondary' : 'default'}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {form.status === 'published' ? 'Despublicar' : 'Publicar'}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b px-4 shrink-0">
              <TabsList className="h-12">
                <TabsTrigger value="fields" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Campos
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
                <TabsTrigger value="appearance" className="gap-2">
                  <Palette className="h-4 w-4" />
                  Aparência
                </TabsTrigger>
                <TabsTrigger value="submissions" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Respostas
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="fields" className="flex-1 m-0 overflow-hidden">
              <div className="h-full grid grid-cols-[280px_1fr_320px] divide-x">
                {/* Field Palette */}
                <FieldPalette 
                  formId={form.id} 
                  onFieldAdded={(fieldId) => setSelectedFieldId(fieldId)}
                  fieldsCount={fields?.length || 0}
                />
                
                {/* Canvas */}
                <FieldCanvas 
                  fields={fields || []}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onDeleteField={(id) => deleteField.mutate(id)}
                  onUpdateOrder={(orderedIds) => {
                    const orderedFields = orderedIds.map((id, index) => ({
                      id,
                      position: index,
                    }));
                    updateFieldsOrder.mutate(orderedFields);
                  }}
                />
                
                {/* Properties Panel */}
                <FieldProperties 
                  field={selectedField}
                  onUpdate={(updates) => {
                    if (selectedField) {
                      updateField.mutate({ id: selectedField.id, ...updates });
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 overflow-auto p-6">
              <FormSettingsTab form={form} />
            </TabsContent>

            <TabsContent value="appearance" className="flex-1 m-0 overflow-auto p-6">
              <FormAppearanceTab form={form} />
            </TabsContent>

            <TabsContent value="submissions" className="flex-1 m-0 overflow-auto">
              <SubmissionsList formId={form.id} fields={fields || []} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Share Dialog */}
        <FormShareDialog 
          open={showShareDialog} 
          onOpenChange={setShowShareDialog}
          form={form}
        />
      </div>
    </AppLayout>
  );
};

export default FormBuilder;
