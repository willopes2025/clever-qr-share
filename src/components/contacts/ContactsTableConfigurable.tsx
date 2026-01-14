import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Ban, Check } from "lucide-react";
import { ContactTagBadges } from "./TagManager";
import { TagSelector } from "./ContactTagSelector";
import { ContactWithDeals, Tag } from "@/hooks/useContacts";

interface ContactsTableConfigurableProps {
  contacts: ContactWithDeals[];
  tags: Tag[];
  selectedIds: string[];
  visibleColumns: string[];
  columnOrder: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (contact: ContactWithDeals) => void;
  onDelete: (id: string) => void;
  onToggleOptOut: (id: string, opted_out: boolean) => void;
  onAddTag: (contactId: string, tagId: string) => void;
  onRemoveTag: (contactId: string, tagId: string) => void;
}

const COLUMN_LABELS: Record<string, string> = {
  contact_display_id: 'ID',
  phone: 'Telefone',
  name: 'Nome',
  email: 'Email',
  tags: 'Tags',
  status: 'Status',
  created_at: 'Criado em',
  deal_funnel: 'Funil',
  deal_stage: 'Etapa',
  deal_value: 'Valor',
  deal_expected_close: 'Prev. Fechamento',
  deal_time_in_stage: 'Tempo na Etapa',
};

export function ContactsTableConfigurable({
  contacts,
  tags,
  selectedIds,
  visibleColumns,
  columnOrder,
  onSelectAll,
  onSelectOne,
  onEdit,
  onDelete,
  onToggleOptOut,
  onAddTag,
  onRemoveTag,
}: ContactsTableConfigurableProps) {
  const [expandedTagSelector, setExpandedTagSelector] = useState<string | null>(null);

  // Get ordered visible columns
  const orderedColumns = columnOrder.filter(col => visibleColumns.includes(col));

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getActiveDeal = (contact: ContactWithDeals) => {
    const deals = contact.funnel_deals || [];
    if (deals.length === 0) return null;
    
    // Prioritize deals without closed_at (active deals)
    const activeDeal = deals.find(d => !d.closed_at);
    if (activeDeal) return activeDeal;
    
    // Otherwise return most recent by updated_at
    return deals.sort((a, b) => 
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )[0];
  };

  const getColumnLabel = (columnId: string): string => {
    if (COLUMN_LABELS[columnId]) return COLUMN_LABELS[columnId];
    if (columnId.startsWith('custom_contact_') || columnId.startsWith('custom_deal_')) {
      // Extract the field name from custom field columns
      const key = columnId.replace('custom_contact_', '').replace('custom_deal_', '');
      // Capitalize first letter
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
    }
    return columnId;
  };

  const renderCellContent = (contact: ContactWithDeals, columnId: string) => {
    const activeDeal = getActiveDeal(contact);

    // Contact columns
    switch (columnId) {
      case 'contact_display_id':
        return (
          <span className="text-muted-foreground font-mono text-xs">
            #{contact.contact_display_id || contact.contact_number || '-'}
          </span>
        );
      case 'phone':
        return <span className="font-medium">{formatPhone(contact.phone)}</span>;
      case 'name':
        return contact.name || <span className="text-muted-foreground">-</span>;
      case 'email':
        return contact.email || <span className="text-muted-foreground">-</span>;
      case 'tags':
        return (
          <div className="flex items-center gap-2">
            <ContactTagBadges contactTags={contact.contact_tags} />
            <TagSelector
              tags={tags}
              assignedTagIds={contact.contact_tags?.map((ct) => ct.tag_id) || []}
              onSelect={(tagId) => onAddTag(contact.id, tagId)}
              expanded={expandedTagSelector === contact.id}
              onExpandedChange={(expanded) =>
                setExpandedTagSelector(expanded ? contact.id : null)
              }
            />
          </div>
        );
      case 'status':
        return contact.opted_out ? (
          <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs bg-neon-green/20 text-neon-green border-neon-green/30">
            Ativo
          </Badge>
        );
      case 'created_at':
        return (
          <span className="text-muted-foreground text-sm">
            {format(new Date(contact.created_at), "dd/MM/yy", { locale: ptBR })}
          </span>
        );
    }

    // Deal columns
    switch (columnId) {
      case 'deal_funnel':
        return activeDeal?.funnels?.name || <span className="text-muted-foreground">-</span>;
      case 'deal_stage':
        if (!activeDeal?.funnel_stages) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge
            variant="outline"
            style={{
              backgroundColor: `${activeDeal.funnel_stages.color}20`,
              borderColor: `${activeDeal.funnel_stages.color}50`,
              color: activeDeal.funnel_stages.color,
            }}
            className="text-xs"
          >
            {activeDeal.funnel_stages.name}
          </Badge>
        );
      case 'deal_value':
        if (!activeDeal?.value) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="font-medium text-neon-green">
            R$ {activeDeal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        );
      case 'deal_expected_close':
        if (!activeDeal?.expected_close_date) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm">
            {format(new Date(activeDeal.expected_close_date), "dd/MM/yy", { locale: ptBR })}
          </span>
        );
      case 'deal_time_in_stage':
        if (!activeDeal?.entered_stage_at) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(activeDeal.entered_stage_at), { locale: ptBR, addSuffix: false })}
          </span>
        );
    }

    // Custom contact fields
    if (columnId.startsWith('custom_contact_')) {
      const fieldKey = columnId.replace('custom_contact_', '');
      const value = contact.custom_fields?.[fieldKey];
      if (value === undefined || value === null || value === '') {
        return <span className="text-muted-foreground">-</span>;
      }
      if (typeof value === 'boolean') {
        return value ? <Check className="h-4 w-4 text-neon-green" /> : <span className="text-muted-foreground">-</span>;
      }
      return String(value);
    }

    // Custom deal fields
    if (columnId.startsWith('custom_deal_')) {
      const fieldKey = columnId.replace('custom_deal_', '');
      const value = activeDeal?.custom_fields?.[fieldKey];
      if (value === undefined || value === null || value === '') {
        return <span className="text-muted-foreground">-</span>;
      }
      if (typeof value === 'boolean') {
        return value ? <Check className="h-4 w-4 text-neon-green" /> : <span className="text-muted-foreground">-</span>;
      }
      return String(value);
    }

    return <span className="text-muted-foreground">-</span>;
  };

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum contato encontrado com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neon-cyan/20 overflow-hidden bg-dark-800/30">
      <Table>
        <TableHeader>
          <TableRow className="border-neon-cyan/20 hover:bg-dark-700/50">
            <TableHead className="w-12">
              <Checkbox
                checked={
                  contacts.length > 0 &&
                  selectedIds.length === contacts.length
                }
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            {orderedColumns.map((columnId) => (
              <TableHead key={columnId} className="text-neon-cyan/80">
                {getColumnLabel(columnId)}
              </TableHead>
            ))}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className="border-neon-cyan/10 hover:bg-dark-700/30 transition-colors"
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(contact.id)}
                  onCheckedChange={(checked) =>
                    onSelectOne(contact.id, checked as boolean)
                  }
                />
              </TableCell>
              {orderedColumns.map((columnId) => (
                <TableCell key={columnId}>
                  {renderCellContent(contact, columnId)}
                </TableCell>
              ))}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(contact)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onToggleOptOut(contact.id, !contact.opted_out)
                      }
                    >
                      {contact.opted_out ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Desbloquear
                        </>
                      ) : (
                        <>
                          <Ban className="h-4 w-4 mr-2" />
                          Bloquear
                        </>
                      )}
                    </DropdownMenuItem>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
