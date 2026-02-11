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
import { Loader2, Download, Users, Tag, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhoneWithCountryCode } from "@/lib/phone-utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

  useEffect(() => {
    if (open) {
      loadTags();
      setSelectedTagIds([]);
      setNewTagName("");
    }
  }, [open]);

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
          .select('id')
          .eq('user_id', user.id)
          .or(`phone.eq.${phoneIdentifier},phone.eq.${instagramIdentifier}`)
          .maybeSingle();

        if (existing) {
          // Even if contact exists, add selected tags
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
        if (profile.is_verified) {
          notes.push('✓ Perfil verificado');
        }
        if (profile.is_private) {
          notes.push('🔒 Perfil privado');
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
            custom_fields: {
              instagram_username: profile.username,
              instagram_verified: profile.is_verified,
              instagram_private: profile.is_private,
              instagram_source: profile.source_username,
              instagram_scrape_type: profile.scrape_type,
              instagram_original_phone: profile.phone || null,
              instagram_email: profile.email || null,
              source: 'instagram_scraper'
            }
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error importing contact:', error);
        } else if (inserted) {
          imported++;
          // Add tags to newly created contact
          if (selectedTagIds.length > 0) {
            for (const tagId of selectedTagIds) {
              await supabase
                .from('contact_tags')
                .insert({ contact_id: inserted.id, tag_id: tagId });
            }
          }
        }
      }

      if (imported > 0) {
        toast.success(`${imported} contato(s) importado(s) com sucesso`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} contato(s) já existiam e foram ignorados`);
      }
      if (imported === 0 && skipped === 0) {
        toast.warning('Nenhum contato foi importado');
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Leads do Instagram
          </DialogTitle>
          <DialogDescription>
            Importar {profiles.length} perfil(is) selecionado(s) para seus contatos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">{profiles.length} perfis selecionados</p>
              <p className="text-sm text-muted-foreground">
                {publicProfiles.length} públicos, {privateProfiles.length} privados
              </p>
            </div>
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Tags para aplicar
            </label>
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
            {selectedTagIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedTagIds.length} tag(s) serão aplicadas aos contatos importados
              </p>
            )}
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Mapeamento de campos:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Nome:</strong> Nome completo ou username</li>
              <li>• <strong>Identificador:</strong> instagram:@username</li>
              <li>• <strong>Avatar:</strong> Foto do perfil</li>
              <li>• <strong>Notas:</strong> Info do perfil e origem</li>
              <li>• <strong>Campos personalizados:</strong> Username, verificado, privado, fonte</li>
            </ul>
          </div>
        </div>

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