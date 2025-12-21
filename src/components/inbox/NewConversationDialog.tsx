import { useState, useEffect } from "react";
import { Plus, Search, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useContacts } from "@/hooks/useContacts";
import { useConversations } from "@/hooks/useConversations";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";

interface NewConversationDialogProps {
  onConversationCreated: (conversationId: string) => void;
}

export const NewConversationDialog = ({ onConversationCreated }: NewConversationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const { contacts, isLoading } = useContacts();
  const { createConversation } = useConversations();
  const { instances } = useWhatsAppInstances();

  // Get connected instances only
  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

  // Set default instance when instances load
  useEffect(() => {
    if (connectedInstances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(connectedInstances[0].id);
    }
  }, [connectedInstances, selectedInstanceId]);

  const filteredContacts = contacts?.filter(contact => {
    const name = contact.name || "";
    const phone = contact.phone || "";
    const search = searchTerm.toLowerCase();
    return name.toLowerCase().includes(search) || phone.includes(search);
  }) || [];

  const handleSelectContact = async (contactId: string) => {
    if (!selectedInstanceId) return;
    
    try {
      const result = await createConversation.mutateAsync({ 
        contactId,
        instanceId: selectedInstanceId 
      });
      if (result) {
        onConversationCreated(result.id);
        setOpen(false);
        setSearchTerm("");
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Nova Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Instance Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Enviar via</Label>
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger>
                <Smartphone className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecionar número" />
              </SelectTrigger>
              <SelectContent>
                {connectedInstances.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhuma instância conectada
                  </div>
                ) : (
                  connectedInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.instance_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : connectedInstances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Conecte uma instância do WhatsApp primeiro
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    disabled={createConversation.isPending || !selectedInstanceId}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-medium shrink-0">
                      {(contact.name || contact.phone)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {contact.name || contact.phone}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.phone}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
