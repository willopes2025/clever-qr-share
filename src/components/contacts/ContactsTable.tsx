import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Ban,
  CheckCircle,
  Tag as TagIcon,
} from "lucide-react";
import { ContactWithTags, Tag } from "@/hooks/useContacts";
import { ContactTagBadges, TagSelector } from "./TagManager";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContactsTableProps {
  contacts: ContactWithTags[];
  tags: Tag[];
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (contact: ContactWithTags) => void;
  onDelete: (id: string) => void;
  onToggleOptOut: (id: string, opted_out: boolean) => void;
  onAddTag: (contactId: string, tagId: string) => void;
  onRemoveTag: (contactId: string, tagId: string) => void;
}

export const ContactsTable = ({
  contacts,
  tags,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onEdit,
  onDelete,
  onToggleOptOut,
  onAddTag,
  onRemoveTag,
}: ContactsTableProps) => {
  const [tagMenuContact, setTagMenuContact] = useState<string | null>(null);

  const formatPhone = (phone: string) => {
    if (phone.length === 13) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    if (phone.length === 12) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < contacts.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                }}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhum contato encontrado
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow key={contact.id} className={contact.opted_out ? "opacity-50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(contact.id)}
                    onCheckedChange={(checked) => onSelectOne(contact.id, !!checked)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatPhone(contact.phone)}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{contact.name || "-"}</p>
                    {contact.email && (
                      <p className="text-xs text-muted-foreground">{contact.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ContactTagBadges contactTags={contact.contact_tags} />
                    <DropdownMenu
                      open={tagMenuContact === contact.id}
                      onOpenChange={(open) => setTagMenuContact(open ? contact.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <TagIcon className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <div className="p-2">
                          <p className="text-xs font-medium mb-2">Adicionar/Remover Tags</p>
                          <TagSelector
                            tags={tags}
                            selectedTags={contact.contact_tags?.map((ct) => ct.tag_id) || []}
                            onToggleTag={(tagId) => {
                              const hasTag = contact.contact_tags?.some(
                                (ct) => ct.tag_id === tagId
                              );
                              if (hasTag) {
                                onRemoveTag(contact.id, tagId);
                              } else {
                                onAddTag(contact.id, tagId);
                              }
                            }}
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
                <TableCell>
                  {contact.opted_out ? (
                    <Badge variant="destructive" className="text-xs">
                      Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                      Ativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(contact.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(contact)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onToggleOptOut(contact.id, !contact.opted_out)}
                      >
                        {contact.opted_out ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Desbloquear
                          </>
                        ) : (
                          <>
                            <Ban className="h-4 w-4 mr-2" />
                            Bloquear
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(contact.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
