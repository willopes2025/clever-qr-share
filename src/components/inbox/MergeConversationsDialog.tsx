import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Merge, Calendar, ArrowLeft } from "lucide-react";
import { useConversationActions } from "@/hooks/useConversationActions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MergeFieldComparison, buildFieldRows, getAutoSelections } from "./MergeFieldComparison";

interface MergeConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName: string;
  contactPhone: string;
  onMerged?: () => void;
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const normalizePhone = (p: string) => {
  const digits = p.replace(/\D/g, '');
  return digits.startsWith('55') ? digits.slice(2) : digits;
};

const phonesMatch = (a: string, b: string) => {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na === nb) return true;
  if (na.length === nb.length + 1 && na.startsWith(nb.slice(0, 2)) && na.slice(2) === '9' + nb.slice(2)) return true;
  if (nb.length === na.length + 1 && nb.startsWith(na.slice(0, 2)) && nb.slice(2) === '9' + na.slice(2)) return true;
  return false;
};

export const MergeConversationsDialog = ({
  open,
  onOpenChange,
  conversationId,
  contactName,
  contactPhone,
  onMerged,
}: MergeConversationsDialogProps) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'compare'>('select');
  const [selections, setSelections] = useState<Record<string, 'a' | 'b'>>({});
  const { mergeConversations } = useConversationActions();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedConversationId(null);
      setStep('select');
      setSelections({});
    }
  }, [open]);

  // Find duplicate conversations
  const { data: duplicates, isLoading } = useQuery({
    queryKey: ['duplicate-conversations', conversationId, contactName, contactPhone],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const firstName = contactName.trim().split(/\s+/)[0];
      
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`id, status, created_at, last_message_at, unread_count, provider, contact:contacts!inner(id, name, phone)`)
        .neq('id', conversationId)
        .ilike('contacts.name', `%${firstName}%`)
        .order('last_message_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const phoneDigits = contactPhone.replace(/\D/g, '');
      const phoneSuffix = phoneDigits.slice(-8);
      
      const { data: phoneConversations, error: phoneError } = await supabase
        .from('conversations')
        .select(`id, status, created_at, last_message_at, unread_count, provider, contact:contacts!inner(id, name, phone)`)
        .neq('id', conversationId)
        .ilike('contacts.phone', `%${phoneSuffix}%`)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (phoneError) throw phoneError;

      const allConversations = [...(conversations || [])];
      const existingIds = new Set(allConversations.map((c: any) => c.id));
      for (const conv of (phoneConversations || [])) {
        if (!existingIds.has((conv as any).id)) {
          allConversations.push(conv);
        }
      }

      const searchNameNorm = normalize(contactName);

      return allConversations.filter((conv: any) => {
        const name = normalize(conv.contact?.name || '');
        const phone = conv.contact?.phone || '';
        return phonesMatch(phone, contactPhone) || 
               (searchNameNorm.length > 3 && name.includes(searchNameNorm)) ||
               (name.length > 3 && searchNameNorm.includes(name));
      });
    },
    enabled: open,
  });

  // Fetch full contact data for both contacts when entering compare step
  const selectedDuplicate = duplicates?.find((c: any) => c.id === selectedConversationId);
  const keepContactId = duplicates ? undefined : undefined; // we'll fetch from conversation

  const { data: contactsData } = useQuery({
    queryKey: ['merge-contacts-compare', conversationId, selectedConversationId],
    queryFn: async () => {
      // Get keep conversation contact
      const { data: keepConv } = await supabase
        .from('conversations')
        .select('contact:contacts!inner(id, name, phone, email, notes, custom_fields)')
        .eq('id', conversationId)
        .single();

      // Get merge conversation contact
      const { data: mergeConv } = await supabase
        .from('conversations')
        .select('contact:contacts!inner(id, name, phone, email, notes, custom_fields)')
        .eq('id', selectedConversationId!)
        .single();

      return {
        contactA: (keepConv as any)?.contact || null,
        contactB: (mergeConv as any)?.contact || null,
      };
    },
    enabled: step === 'compare' && !!selectedConversationId,
  });

  // Auto-populate selections when contact data loads
  useEffect(() => {
    if (contactsData?.contactA && contactsData?.contactB) {
      const rows = buildFieldRows(contactsData.contactA, contactsData.contactB);
      setSelections(getAutoSelections(rows));
    }
  }, [contactsData]);

  const handleNext = () => {
    if (!selectedConversationId) return;
    setStep('compare');
  };

  const handleBack = () => {
    setStep('select');
    setSelections({});
  };

  const handleMerge = () => {
    if (!selectedConversationId || !contactsData) return;

    const { contactA, contactB } = contactsData;
    // Build contactUpdates from selections
    const contactUpdates: Record<string, any> = {};
    const customFieldUpdates: Record<string, any> = {};

    for (const [key, source] of Object.entries(selections)) {
      const sourceContact = source === 'a' ? contactA : contactB;
      if (key === '_name') contactUpdates.name = sourceContact.name;
      else if (key === '_phone') contactUpdates.phone = sourceContact.phone;
      else if (key === '_email') contactUpdates.email = sourceContact.email;
      else if (key === '_notes') contactUpdates.notes = sourceContact.notes;
      else if (key.startsWith('cf_')) {
        const cfKey = key.slice(3);
        customFieldUpdates[cfKey] = sourceContact.custom_fields?.[cfKey] ?? null;
      }
    }

    if (Object.keys(customFieldUpdates).length > 0) {
      contactUpdates.custom_fields = {
        ...(contactA.custom_fields || {}),
        ...customFieldUpdates,
      };
    }

    mergeConversations.mutate(
      { keepConversationId: conversationId, mergeConversationId: selectedConversationId, contactUpdates },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedConversationId(null);
          setStep('select');
          setSelections({});
          onMerged?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("transition-all", step === 'compare' ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            {step === 'select' ? 'Unificar Conversas' : 'Comparar Campos'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' ? (
              <>Selecione a conversa duplicada para unificar com a conversa atual de <strong>{contactName}</strong>.</>
            ) : (
              <>Clique no valor que deseja manter para cada campo. Campos iguais são mantidos automaticamente.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <ScrollArea className="max-h-[300px]">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Buscando conversas duplicadas...</div>
            ) : !duplicates?.length ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Nenhuma conversa duplicada encontrada para este contato.
              </div>
            ) : (
              <div className="space-y-2 p-1">
                {duplicates.map((conv: any) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      selectedConversationId === conv.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{conv.contact?.name || 'Sem nome'}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {conv.status === 'archived' ? 'Arquivada' : conv.status === 'closed' ? 'Fechada' : 'Ativa'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{conv.contact?.phone}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {conv.last_message_at 
                          ? format(new Date(conv.last_message_at), "dd/MM/yy HH:mm", { locale: ptBR })
                          : 'Sem mensagens'}
                      </span>
                      {conv.unread_count > 0 && (
                        <Badge className="h-4 px-1 text-[10px]">{conv.unread_count}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          contactsData?.contactA && contactsData?.contactB ? (
            <MergeFieldComparison
              contactA={contactsData.contactA}
              contactB={contactsData.contactB}
              selections={selections}
              onSelectionChange={(key, source) => setSelections(prev => ({ ...prev, [key]: source }))}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">Carregando dados dos contatos...</div>
          )
        )}

        <DialogFooter>
          {step === 'compare' && (
            <Button variant="outline" onClick={handleBack} className="mr-auto">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {step === 'select' ? (
            <Button onClick={handleNext} disabled={!selectedConversationId}>
              Próximo
            </Button>
          ) : (
            <Button
              onClick={handleMerge}
              disabled={!selectedConversationId || mergeConversations.isPending}
            >
              <Merge className="h-4 w-4 mr-2" />
              {mergeConversations.isPending ? 'Unificando...' : 'Unificar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
