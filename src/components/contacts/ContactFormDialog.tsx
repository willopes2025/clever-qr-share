import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, GitBranch } from "lucide-react";
import { Contact } from "@/hooks/useContacts";
import { useCustomFields, FieldType } from "@/hooks/useCustomFields";
import { useFunnels } from "@/hooks/useFunnels";
import { DynamicField } from "./DynamicField";
import { FieldSelector } from "./FieldSelector";
import { InlineFieldCreator } from "./InlineFieldCreator";
import { toast } from "sonner";

const contactSchema = z.object({
  phone: z
    .string()
    .min(10, "Número deve ter pelo menos 10 dígitos")
    .max(15, "Número deve ter no máximo 15 dígitos"),
  name: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContactFormValues & { 
    custom_fields?: Record<string, unknown>;
    funnel_id?: string;
    stage_id?: string;
  }) => void;
  contact?: Contact | null;
  isLoading?: boolean;
  currentDeal?: {
    funnel_id: string;
    stage_id: string;
  } | null;
}

export const ContactFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  contact,
  isLoading,
  currentDeal,
}: ContactFormDialogProps) => {
  const { fieldDefinitions, updateField, createField, deleteField } = useCustomFields();
  const { funnels } = useFunnels();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [addedFieldIds, setAddedFieldIds] = useState<string[]>([]);
  const [showCreateField, setShowCreateField] = useState(false);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      phone: contact?.phone || "",
      name: contact?.name || "",
      email: contact?.email || "",
      notes: contact?.notes || "",
    },
  });

  useEffect(() => {
    form.reset({
      phone: contact?.phone || "",
      name: contact?.name || "",
      email: contact?.email || "",
      notes: contact?.notes || "",
    });
    
    // Load custom field values from contact
    const existingCustomFields = (contact?.custom_fields as Record<string, unknown>) || {};
    setCustomFieldValues(existingCustomFields);
    
    // When editing, add fields that have values
    if (contact && fieldDefinitions) {
      const fieldsWithValues = fieldDefinitions
        .filter((def) => existingCustomFields[def.field_key] !== undefined)
        .map((def) => def.id);
      setAddedFieldIds(fieldsWithValues);
    } else {
      setAddedFieldIds([]);
    }
  }, [contact, form, fieldDefinitions]);

  // Reset states when dialog closes or load current deal when editing
  useEffect(() => {
    if (!open) {
      setShowCreateField(false);
      setSelectedFunnelId("");
      setSelectedStageId("");
    } else if (contact && currentDeal) {
      // Pre-fill funnel and stage when editing a contact with existing deal
      setSelectedFunnelId(currentDeal.funnel_id);
      setSelectedStageId(currentDeal.stage_id);
    }
  }, [open, contact, currentDeal]);

  const handleSubmit = (data: ContactFormValues) => {
    // Only include values for added fields
    const filteredCustomFields: Record<string, unknown> = {};
    addedFieldIds.forEach((fieldId) => {
      const def = fieldDefinitions?.find((d) => d.id === fieldId);
      if (def && customFieldValues[def.field_key] !== undefined) {
        filteredCustomFields[def.field_key] = customFieldValues[def.field_key];
      }
    });

    onSubmit({
      ...data,
      custom_fields: filteredCustomFields,
      funnel_id: selectedFunnelId || undefined,
      stage_id: selectedStageId || undefined,
    });
    form.reset();
    setCustomFieldValues({});
    setAddedFieldIds([]);
    setSelectedFunnelId("");
    setSelectedStageId("");
  };

  const handleCustomFieldChange = (fieldKey: string, value: unknown) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  const handleAddOption = async (fieldId: string, option: string) => {
    const field = fieldDefinitions?.find((f) => f.id === fieldId);
    if (field) {
      const currentOptions = (field.options as string[]) || [];
      if (!currentOptions.includes(option)) {
        await updateField.mutateAsync({
          id: fieldId,
          options: [...currentOptions, option],
        });
      }
    }
  };

  const handleSelectField = (fieldId: string) => {
    if (!addedFieldIds.includes(fieldId)) {
      setAddedFieldIds((prev) => [...prev, fieldId]);
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setAddedFieldIds((prev) => prev.filter((id) => id !== fieldId));
    // Also clear the value
    const def = fieldDefinitions?.find((d) => d.id === fieldId);
    if (def) {
      setCustomFieldValues((prev) => {
        const newValues = { ...prev };
        delete newValues[def.field_key];
        return newValues;
      });
    }
  };

  const handleConfirmDeleteDefinition = async () => {
    if (!deleteFieldId) return;

    try {
      await deleteField.mutateAsync(deleteFieldId);
      // Remove from this dialog UI immediately
      handleRemoveField(deleteFieldId);
      setDeleteFieldId(null);
    } catch (e: any) {
      toast.error("Erro ao excluir campo", {
        description: e?.message,
      });
    }
  };

  const handleCreateField = async (field: {
    field_name: string;
    field_key: string;
    field_type: FieldType;
    is_required: boolean;
    options: string[];
    display_order: number;
    entity_type?: 'contact' | 'lead';
  }) => {
    const result = await createField.mutateAsync({
      ...field,
      entity_type: field.entity_type || 'contact',
    });
    if (result?.id) {
      setAddedFieldIds((prev) => [...prev, result.id]);
    }
    setShowCreateField(false);
  };

  const addedFields = fieldDefinitions?.filter((def) =>
    addedFieldIds.includes(def.id)
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {contact ? "Editar Contato" : "Novo Contato"}
          </DialogTitle>
          <DialogDescription>
            {contact ? "Edite as informações do contato." : "Adicione um novo contato à sua base."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="5511999999999"
                        {...field}
                        disabled={!!contact}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do contato" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Anotações sobre o contato..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Funnel Selection - Show for both create and edit */}
              {funnels && funnels.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Adicionar ao Funil (Opcional)
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Funil</label>
                        <Select
                          value={selectedFunnelId}
                          onValueChange={(value) => {
                            setSelectedFunnelId(value);
                            setSelectedStageId("");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um funil" />
                          </SelectTrigger>
                          <SelectContent>
                            {funnels.map((funnel) => (
                              <SelectItem key={funnel.id} value={funnel.id}>
                                {funnel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Etapa</label>
                        <Select
                          value={selectedStageId}
                          onValueChange={setSelectedStageId}
                          disabled={!selectedFunnelId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={selectedFunnelId ? "Selecione a etapa" : "Selecione o funil primeiro"} />
                          </SelectTrigger>
                          <SelectContent>
                            {funnels
                              .find(f => f.id === selectedFunnelId)
                              ?.stages?.filter(s => !s.is_final)
                              .map((stage) => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: stage.color }}
                                    />
                                    {stage.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Added Dynamic Fields */}
              {addedFields.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Campos Adicionais
                    </h4>
                    {addedFields.map((definition) => (
                      <div key={definition.id} className="space-y-2">
                        <label className="text-sm font-medium">
                          {definition.field_name}
                          {definition.is_required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </label>
                        <DynamicField
                          definition={definition}
                          value={customFieldValues[definition.field_key]}
                          onChange={(value) =>
                            handleCustomFieldChange(definition.field_key, value)
                          }
                          onAddOption={
                            definition.field_type === "select" ||
                            definition.field_type === "multi_select"
                              ? handleAddOption
                              : undefined
                          }
                          onRemove={() => handleRemoveField(definition.id)}
                          onDeleteDefinition={() => setDeleteFieldId(definition.id)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Inline Field Creator */}
              {showCreateField && (
                <InlineFieldCreator
                  onSave={handleCreateField}
                  onCancel={() => setShowCreateField(false)}
                  isLoading={createField.isPending}
                />
              )}

              {/* Add Field Button */}
              {!showCreateField && (
                <FieldSelector
                  availableFields={fieldDefinitions || []}
                  addedFieldIds={addedFieldIds}
                  onSelectField={handleSelectField}
                  onCreateNew={() => setShowCreateField(true)}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar campo
                  </Button>
                </FieldSelector>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Salvando..." : contact ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>

        <AlertDialog open={!!deleteFieldId} onOpenChange={(open) => !open && setDeleteFieldId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove o campo para todo o sistema (Contatos e Inbox). Os valores antigos podem permanecer salvos
                nos contatos, mas o campo não será mais exibido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteDefinition}>
                Excluir campo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
