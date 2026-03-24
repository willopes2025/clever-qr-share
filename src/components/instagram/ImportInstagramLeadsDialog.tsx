import { useState, useEffect } from "react";
import { InstagramProfile } from "@/pages/InstagramScraper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Users, Tag, Plus, X, Phone, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhoneWithCountryCode } from "@/lib/phone-utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomFields, CustomFieldDefinition, FieldType } from "@/hooks/useCustomFields";
import { InlineFieldCreator } from "@/components/contacts/InlineFieldCreator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ImportInstagramLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: InstagramProfile[];
  onSuccess: () => void;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

// Instagram profile fields available for mapping
const INSTAGRAM_FIELD_OPTIONS = [
  { value: "username", label: "Username" },
  { value: "biography", label: "Biografia" },
  { value: "business_category", label: "Categoria de negócio" },
  { value: "external_url", label: "URL externa" },
  { value: "followers_count", label: "Seguidores" },
  { value: "following_count", label: "Seguindo" },
  { value: "posts_count", label: "Publicações" },
] as const;

type InstagramFieldKey = typeof INSTAGRAM_FIELD_OPTIONS[number]["value"];

interface CustomFieldMapping {
  fieldId: string;
  source: "instagram" | "manual";
  instagramField?: InstagramFieldKey;
  manualValue?: string;
}

export function ImportInstagramLeadsDialog({
  open,
  onOpenChange,
  profiles,
  onSuccess
}: ImportInstagramLeadsDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [existingTags, setExistingTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [showFieldCreator, setShowFieldCreator] = useState(false);
  const [fieldMappings, setFieldMappings] = useState<CustomFieldMapping[]>([]);
  const [saveAdditionalPhones, setSaveAdditionalPhones] = useState(true);

  const { contactFieldDefinitions, createField } = useCustomFields();

  useEffect(() => {
    if (open) {
      loadTags();
      setSelectedTagIds([]);
      setNewTagName("");
      setFieldMappings([]);
      setShowFieldCreator(false);
      setSaveAdditionalPhones(true);
    }
  }, [open]);

  const profilesWithPhone = profiles.filter(p => p.phone);

  const loadTags = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('tags')
      .select('id, name, color')
      .order('name');
    setExistingTags(data || []);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreatingTag(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: newTagName.trim(), user_id: user.id, color: '#3B82F6' })
        .select('id, name, color')
        .single();
      if (error) {
        toast.error('Erro ao criar tag');
        return;
      }
      if (data) {
        setExistingTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedTagIds(prev => [...prev, data.id]);
        setNewTagName("");
        toast.success(`Tag "${data.name}" criada`);
      }
    } finally {
      setIsCreatingTag(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const addFieldMapping = (fieldId: string) => {
    if (fieldMappings.some(m => m.fieldId === fieldId)) return;
    setFieldMappings(prev => [...prev, { fieldId, source: "manual", manualValue: "" }]);
  };

  const updateFieldMapping = (fieldId: string, updates: Partial<CustomFieldMapping>) => {
    setFieldMappings(prev =>
      prev.map(m => m.fieldId === fieldId ? { ...m, ...updates } : m)
    );
  };

  const removeFieldMapping = (fieldId: string) => {
    setFieldMappings(prev => prev.filter(m => m.fieldId !== fieldId));
  };

  const handleCreateField = async (field: Parameters<typeof createField.mutateAsync>[0]) => {
    try {
      const result = await createField.mutateAsync(field);
      if (result?.id) {
        setFieldMappings(prev => [...prev, { fieldId: result.id, source: "manual", manualValue: "" }]);
      }
      setShowFieldCreator(false);
    } catch {
      // error handled by mutation
    }
  };

  const getInstagramValue = (profile: InstagramProfile, key: InstagramFieldKey): string => {
    const val = profile[key];
    if (val === null || val === undefined) return "";
    return String(val);
  };

  const buildCustomFields = (profile: InstagramProfile): Record<string, any> => {
    const base: Record<string, any> = {
      instagram_username: profile.username,
      instagram_verified: profile.is_verified,
      instagram_private: profile.is_private,
      instagram_source: profile.source_username,
      instagram_scrape_type: profile.scrape_type,
      instagram_original_phone: profile.phone || null,
      instagram_email: profile.email || null,
      source: 'instagram_scraper'
    };

    // Apply field mappings
    for (const mapping of fieldMappings) {
      const fieldDef = contactFieldDefinitions.find(f => f.id === mapping.fieldId);
      if (!fieldDef) continue;

      if (mapping.source === "instagram" && mapping.instagramField) {
        base[fieldDef.field_key] = getInstagramValue(profile, mapping.instagramField);
      } else if (mapping.source === "manual" && mapping.manualValue) {
        base[fieldDef.field_key] = mapping.manualValue;
      }
    }

    // Additional phones
    if (saveAdditionalPhones && profile.phone) {
      const phoneIdentifier = `instagram:${profile.username}`;
      const isPrimaryInstagram = !profile.phone; // only add if primary is instagram:
      // If primary is instagram:username, store phone as additional
      const normalizedPhone = normalizePhoneWithCountryCode(profile.phone, '55');
      const primaryIsInstagram = phoneIdentifier === `instagram:${profile.username}`;
      // We always use phone as primary if available, so additional_phones is for when
      // a profile has a phone AND we want to keep instagram identifier as primary
      // Actually: if profile has phone, phone IS the primary. So additional_phones
      // is not needed in that case. But if user wants instagram: as identifier...
      // Let's store it as additional_phones only when the primary is instagram:
    }

    return base;
  };

  const handleImport = async () => {
    setIsImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado');
        setIsImporting(false);
        return;
      }

      let imported = 0;
      let skipped = 0;

      for (const profile of profiles) {
        let phoneIdentifier: string;
        if (profile.phone) {
          phoneIdentifier = normalizePhoneWithCountryCode(profile.phone, '55');
        } else {
          phoneIdentifier = `instagram:${profile.username}`;
        }
        
        const instagramIdentifier = `instagram:${profile.username}`;
        
        const { data: existing } = await supabase
          .from('contacts')
          .select('id, custom_fields')
          .eq('user_id', user.id)
          .or(`phone.eq.${phoneIdentifier},phone.eq.${instagramIdentifier}`)
          .maybeSingle();

        if (existing) {
          // Update custom fields on existing contact if mappings are set
          if (fieldMappings.length > 0 || (saveAdditionalPhones && profile.phone)) {
            const existingCustom = (existing.custom_fields as Record<string, any>) || {};
            const newCustom = buildCustomFields(profile);
            // Merge: new values override existing for mapped keys
            const merged = { ...existingCustom, ...newCustom };

            // Handle additional phones for existing contacts
            if (saveAdditionalPhones && profile.phone && existing.custom_fields) {
              const normalizedPhone = normalizePhoneWithCountryCode(profile.phone, '55');
              const existingPhones: string[] = (existingCustom.additional_phones as string[]) || [];
              if (!existingPhones.includes(normalizedPhone) && phoneIdentifier !== normalizedPhone) {
                merged.additional_phones = [...existingPhones, normalizedPhone];
              }
            }

            await supabase
              .from('contacts')
              .update({ custom_fields: merged })
              .eq('id', existing.id);
          }

          // Add selected tags
          if (selectedTagIds.length > 0) {
            for (const tagId of selectedTagIds) {
              await supabase
                .from('contact_tags')
                .upsert(
                  { contact_id: existing.id, tag_id: tagId },
                  { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
                );
            }
          }
          skipped++;
          continue;
        }

        const notes: string[] = [];
        notes.push(`Instagram: @${profile.username}`);
        if (profile.source_username) {
          const typeLabel = profile.scrape_type === 'followers' ? 'Seguidor de' : 'Seguindo';
          notes.push(`${typeLabel}: @${profile.source_username}`);
        }
        if (profile.is_verified) notes.push('✓ Perfil verificado');
        if (profile.is_private) notes.push('🔒 Perfil privado');

        const customFields = buildCustomFields(profile);

        // If primary is phone but we want to also store the instagram identifier phone
        // and there's a phone, handle additional_phones
        if (saveAdditionalPhones && profile.phone) {
          // Primary is the normalized phone. No additional phone needed since phone IS the primary.
          // But if user later changes primary to instagram:, the phone stays in custom_fields.
        }

        const { data: inserted, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            name: profile.full_name || profile.username,
            phone: phoneIdentifier,
            email: profile.email || null,
            avatar_url: profile.profile_pic_url || null,
            notes: notes.join('\n'),
            status: 'lead',
            custom_fields: customFields
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error importing contact:', error);
        } else if (inserted) {
          imported++;
          if (selectedTagIds.length > 0) {
            for (const tagId of selectedTagIds) {
              await supabase
                .from('contact_tags')
                .insert({ contact_id: inserted.id, tag_id: tagId });
            }
          }
        }
      }

      if (imported > 0) toast.success(`${imported} contato(s) importado(s) com sucesso`);
      if (skipped > 0) toast.info(`${skipped} contato(s) já existiam e foram atualizados`);
      if (imported === 0 && skipped === 0) toast.warning('Nenhum contato foi importado');

      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar contatos');
    } finally {
      setIsImporting(false);
    }
  };

  const publicProfiles = profiles.filter(p => !p.is_private);
  const privateProfiles = profiles.filter(p => p.is_private);

  const mappedFieldIds = fieldMappings.map(m => m.fieldId);
  const unmappedFields = contactFieldDefinitions.filter(f => !mappedFieldIds.includes(f.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Leads do Instagram
          </DialogTitle>
          <DialogDescription>
            Importar {profiles.length} perfil(is) selecionado(s) para seus contatos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Users className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-medium">{profiles.length} perfis selecionados</p>
                <p className="text-sm text-muted-foreground">
                  {publicProfiles.length} públicos, {privateProfiles.length} privados
                  {profilesWithPhone.length > 0 && `, ${profilesWithPhone.length} com telefone`}
                </p>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["tags"]} className="w-full">
              {/* Tags Section */}
              <AccordionItem value="tags">
                <AccordionTrigger className="text-sm font-medium py-2">
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-4 w-4" />
                    Tags ({selectedTagIds.length} selecionadas)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-lg bg-background">
                      {existingTags.length === 0 && selectedTagIds.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nenhuma tag disponível</span>
                      )}
                      {existingTags.map(tag => (
                        <Badge
                          key={tag.id}
                          variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                          className="cursor-pointer text-xs transition-colors"
                          style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                          {selectedTagIds.includes(tag.id) && <X className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Criar nova tag..."
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim() || isCreatingTag}
                        className="h-8 px-3"
                      >
                        {isCreatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Custom Fields Section */}
              <AccordionItem value="custom-fields">
                <AccordionTrigger className="text-sm font-medium py-2">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Campos personalizados ({fieldMappings.length} mapeados)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    {fieldMappings.map(mapping => {
                      const fieldDef = contactFieldDefinitions.find(f => f.id === mapping.fieldId);
                      if (!fieldDef) return null;
                      return (
                        <div key={mapping.fieldId} className="p-2.5 border rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{fieldDef.field_name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeFieldMapping(mapping.fieldId)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Select
                              value={mapping.source}
                              onValueChange={(val: "instagram" | "manual") =>
                                updateFieldMapping(mapping.fieldId, { source: val, manualValue: "", instagramField: undefined })
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="instagram">Do Instagram</SelectItem>
                                <SelectItem value="manual">Valor fixo</SelectItem>
                              </SelectContent>
                            </Select>

                            {mapping.source === "instagram" ? (
                              <Select
                                value={mapping.instagramField || ""}
                                onValueChange={(val) =>
                                  updateFieldMapping(mapping.fieldId, { instagramField: val as InstagramFieldKey })
                                }
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder="Selecionar campo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INSTAGRAM_FIELD_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="h-8 flex-1 text-xs"
                                placeholder="Valor para todos os contatos"
                                value={mapping.manualValue || ""}
                                onChange={e =>
                                  updateFieldMapping(mapping.fieldId, { manualValue: e.target.value })
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add field or create new */}
                    {showFieldCreator ? (
                      <InlineFieldCreator
                        onSave={handleCreateField}
                        onCancel={() => setShowFieldCreator(false)}
                        isLoading={createField.isPending}
                        defaultEntityType="contact"
                      />
                    ) : (
                      <div className="flex gap-2">
                        {unmappedFields.length > 0 && (
                          <Select onValueChange={addFieldMapping}>
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Adicionar campo existente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {unmappedFields.map(field => (
                                <SelectItem key={field.id} value={field.id}>
                                  {field.field_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={() => setShowFieldCreator(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Criar campo
                        </Button>
                      </div>
                    )}

                    {fieldMappings.length === 0 && !showFieldCreator && (
                      <p className="text-xs text-muted-foreground">
                        Selecione campos para preencher automaticamente com dados do Instagram ou valores fixos.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Additional Phones Section */}
              {profilesWithPhone.length > 0 && (
                <AccordionItem value="phones">
                  <AccordionTrigger className="text-sm font-medium py-2">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      Telefones adicionais ({profilesWithPhone.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">Salvar telefones extras</p>
                          <p className="text-xs text-muted-foreground">
                            {profilesWithPhone.length} perfil(is) possuem telefone. 
                            Quando o identificador principal for instagram:@usuario, 
                            o telefone será salvo como campo adicional.
                          </p>
                        </div>
                        <Switch
                          checked={saveAdditionalPhones}
                          onCheckedChange={setSaveAdditionalPhones}
                        />
                      </div>
                      {saveAdditionalPhones && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          Os telefones serão armazenados no campo <code className="font-mono bg-muted px-1 rounded">additional_phones</code> dos dados personalizados do contato.
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Field mapping info */}
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">Mapeamento padrão:</p>
              <ul className="space-y-0.5 text-xs">
                <li>• <strong>Nome:</strong> Nome completo ou username</li>
                <li>• <strong>Identificador:</strong> Telefone ou instagram:@username</li>
                <li>• <strong>Avatar:</strong> Foto do perfil</li>
                <li>• <strong>Notas:</strong> Info do perfil e origem</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={isImporting} className="gap-2">
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
