import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForms } from "@/hooks/useForms";
import { Loader2 } from "lucide-react";

interface CreateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens
    .trim();
};

export const CreateFormDialog = ({ open, onOpenChange }: CreateFormDialogProps) => {
  const navigate = useNavigate();
  const { createForm } = useForms();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setSlug(generateSlug(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createForm.mutate(
      {
        name,
        description: description || null,
        slug: slug || generateSlug(name),
        status: 'draft',
        page_title: name,
        header_text: name,
        subheader_text: description || null,
        logo_url: null,
        background_color: '#ffffff',
        primary_color: '#3b82f6',
        font_family: 'Inter',
        success_message: 'Obrigado! Sua resposta foi enviada.',
        redirect_url: null,
        submit_button_text: 'Enviar',
        meta_description: description || null,
        og_image_url: null,
        settings: {},
        target_funnel_id: null,
        target_stage_id: null,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          setName("");
          setDescription("");
          setSlug("");
          setSlugEdited(false);
          navigate(`/forms/${data.id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar novo formulário</DialogTitle>
          <DialogDescription>
            Dê um nome ao seu formulário e comece a adicionar campos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do formulário *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Cadastro de Lead"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL do formulário</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/f/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="cadastro-de-lead"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O link público do seu formulário
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do formulário..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name || createForm.isPending}>
              {createForm.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Formulário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
