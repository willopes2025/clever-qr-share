import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Users, User } from "lucide-react";
import { WarmingContact } from "@/hooks/useWarming";

interface WarmingContactsManagerProps {
  contacts: WarmingContact[];
  onAdd: (data: { phone: string; name?: string; type: 'individual' | 'group' }) => void;
  onDelete: (contactId: string) => void;
  isAdding?: boolean;
}

export function WarmingContactsManager({ contacts, onAdd, onDelete, isAdding }: WarmingContactsManagerProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'individual' | 'group'>('individual');

  const handleSubmit = () => {
    if (!phone.trim()) return;
    onAdd({ phone: phone.trim(), name: name.trim() || undefined, type });
    setPhone('');
    setName('');
    setType('individual');
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Contatos de Aquecimento
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Contato de Aquecimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'individual' | 'group')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Contato Individual</SelectItem>
                    <SelectItem value="group">Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone / ID do Grupo</Label>
                <Input 
                  placeholder={type === 'individual' ? "5511999999999" : "ID do grupo"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {type === 'individual' 
                    ? "Número com código do país, sem espaços ou caracteres especiais"
                    : "ID do grupo no formato xxx@g.us"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nome (opcional)</Label>
                <Input 
                  placeholder="Nome do contato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button onClick={handleSubmit} disabled={!phone.trim() || isAdding} className="w-full">
                Adicionar Contato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum contato de aquecimento cadastrado.
            <br />
            Adicione contatos ou use o pareamento de instâncias.
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div 
                key={contact.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {contact.type === 'group' ? (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{contact.name || contact.phone}</p>
                    {contact.name && (
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {contact.type === 'group' ? 'Grupo' : 'Individual'}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
