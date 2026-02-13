import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { FormField } from "@/hooks/useForms";

interface EditSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: {
    id: string;
    data: Record<string, any>;
    contacts?: { name: string | null; phone: string; email: string | null } | null;
  } | null;
  fields: FormField[];
  onSave: (submissionId: string, updatedData: Record<string, any>) => Promise<void>;
}

export const EditSubmissionDialog = ({ open, onOpenChange, submission, fields, onSave }: EditSubmissionDialogProps) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const visibleFields = fields.filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type));

  useEffect(() => {
    if (submission) {
      setFormData({ ...submission.data });
    }
  }, [submission]);

  const handleSave = async () => {
    if (!submission) return;
    setSaving(true);
    try {
      await onSave(submission.id, formData);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Resposta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {submission.contacts && (
            <div className="p-3 rounded-md bg-muted text-sm">
              <p className="font-medium">{submission.contacts.name || 'Sem nome'}</p>
              <p className="text-muted-foreground">{submission.contacts.phone}</p>
              {submission.contacts.email && (
                <p className="text-muted-foreground">{submission.contacts.email}</p>
              )}
            </div>
          )}

          {visibleFields.map((field) => {
            const value = formData[field.id] ?? formData[field.label] ?? '';
            const fieldKey = field.id in formData ? field.id : field.label;
            const isLongText = field.field_type === 'textarea' || field.field_type === 'long_text';

            return (
              <div key={field.id} className="space-y-1.5">
                <Label>{field.label}</Label>
                {isLongText ? (
                  <Textarea
                    value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    onChange={(e) => setFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    onChange={(e) => setFormData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
