import { useState } from "react";
import { Phone, Plus, Trash2, Star, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhoneNumber, formatForDisplay, extractDigits, validateBrazilianPhone } from "@/lib/phone-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AdditionalPhone {
  phone: string;
  label: string;
}

interface AdditionalPhonesManagerProps {
  contactId: string;
  mainPhone: string;
  customFields: Record<string, any> | null;
}

export const AdditionalPhonesManager = ({ contactId, mainPhone, customFields }: AdditionalPhonesManagerProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const queryClient = useQueryClient();

  const additionalPhones: AdditionalPhone[] = customFields?.additional_phones || [];

  const updateAdditionalPhones = async (phones: AdditionalPhone[]) => {
    const updatedFields = { ...(customFields || {}), additional_phones: phones };
    const { error } = await supabase
      .from('contacts')
      .update({ custom_fields: updatedFields })
      .eq('id', contactId);
    
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const handleAdd = async () => {
    const digits = extractDigits(newPhone);
    if (!digits || digits.length < 10) {
      toast.error("Número inválido");
      return;
    }
    
    const validation = validateBrazilianPhone(digits);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    // Normalize with country code
    const normalized = digits.startsWith('55') ? digits : '55' + digits;

    try {
      await updateAdditionalPhones([
        ...additionalPhones,
        { phone: normalized, label: newLabel.trim() || "Outro" }
      ]);
      setNewPhone("");
      setNewLabel("");
      setIsAdding(false);
      toast.success("Telefone adicionado");
    } catch {
      toast.error("Erro ao adicionar telefone");
    }
  };

  const handleRemove = async (index: number) => {
    try {
      const updated = additionalPhones.filter((_, i) => i !== index);
      await updateAdditionalPhones(updated);
      toast.success("Telefone removido");
    } catch {
      toast.error("Erro ao remover telefone");
    }
  };

  const handleMakePrimary = async (index: number) => {
    const selected = additionalPhones[index];
    try {
      // Move current main phone to additional list
      const updated = additionalPhones.filter((_, i) => i !== index);
      updated.unshift({ phone: mainPhone, label: "Anterior" });
      
      // Update additional phones and main phone
      const updatedFields = { ...(customFields || {}), additional_phones: updated };
      const { error } = await supabase
        .from('contacts')
        .update({ 
          phone: selected.phone,
          custom_fields: updatedFields 
        })
        .eq('id', contactId);
      
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success("Telefone principal atualizado");
    } catch {
      toast.error("Erro ao alterar telefone principal");
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Additional phones list */}
      {additionalPhones.map((ap, index) => (
        <div key={index} className="flex items-center justify-between group">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{formatForDisplay(ap.phone)}</span>
            <span className="text-[10px] text-muted-foreground">({ap.label})</span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleMakePrimary(index)}>
                  <Star className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Tornar principal</p></TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemove(index)}>
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      ))}

      {/* Add phone form */}
      {isAdding ? (
        <div className="space-y-1.5 pt-1">
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
            placeholder="(XX) XXXXX-XXXX"
            className="h-7 text-xs"
            autoFocus
          />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Rótulo (ex: Trabalho)"
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={handleAdd}>
              <Check className="h-3 w-3 mr-1" /> Salvar
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setIsAdding(false); setNewPhone(""); setNewLabel(""); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-[10px] text-muted-foreground w-full justify-start gap-1 px-1"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3" /> Adicionar telefone
        </Button>
      )}
    </div>
  );
};
