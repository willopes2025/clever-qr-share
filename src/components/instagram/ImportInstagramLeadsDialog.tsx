import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportInstagramLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: InstagramProfile[];
  onSuccess: () => void;
}

export function ImportInstagramLeadsDialog({
  open,
  onOpenChange,
  profiles,
  onSuccess
}: ImportInstagramLeadsDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [includeBio, setIncludeBio] = useState(true);

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
        // Use username as phone placeholder if no phone available
        const phoneIdentifier = profile.phone || `instagram:${profile.username}`;
        
        // Check if contact already exists
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .eq('phone', phoneIdentifier)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Build notes from Instagram data
        const notes: string[] = [];
        if (includeBio && profile.biography) {
          notes.push(`Bio: ${profile.biography}`);
        }
        notes.push(`Instagram: @${profile.username}`);
        if (profile.followers_count) {
          notes.push(`Seguidores: ${profile.followers_count}`);
        }
        if (profile.external_url) {
          notes.push(`Link: ${profile.external_url}`);
        }

        const { error } = await supabase
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
              instagram_followers: profile.followers_count,
              instagram_verified: profile.is_verified,
              instagram_business: profile.is_business_account,
              source: 'instagram_scraper'
            }
          });

        if (error) {
          console.error('Error importing contact:', error);
        } else {
          imported++;
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

  const profilesWithContact = profiles.filter(p => p.phone || p.email);

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
                {profilesWithContact.length} com email ou telefone detectado
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Opções de importação</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-bio"
                checked={includeBio}
                onCheckedChange={(checked) => setIncludeBio(checked === true)}
              />
              <Label htmlFor="include-bio" className="text-sm font-normal cursor-pointer">
                Incluir biografia nas notas do contato
              </Label>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Mapeamento de campos:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Nome:</strong> Nome completo ou username</li>
              <li>• <strong>Telefone:</strong> Telefone extraído ou "instagram:@username"</li>
              <li>• <strong>Email:</strong> Email extraído da bio (se disponível)</li>
              <li>• <strong>Avatar:</strong> Foto do perfil</li>
              <li>• <strong>Notas:</strong> Bio, link e stats do perfil</li>
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