import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Filter, MoreVertical, Pencil, Trash2, Eye, Send } from 'lucide-react';
import { BroadcastListWithContacts } from '@/hooks/useBroadcastLists';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BroadcastListListViewProps {
  lists: BroadcastListWithContacts[];
  onView: (list: BroadcastListWithContacts) => void;
  onEdit: (list: BroadcastListWithContacts) => void;
  onDelete: (list: BroadcastListWithContacts) => void;
  onSend: (list: BroadcastListWithContacts) => void;
}

export const BroadcastListListView = ({
  lists, onView, onEdit, onDelete, onSend,
}: BroadcastListListViewProps) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Contatos</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Descrição</th>
            <th className="px-4 py-3 font-medium hidden lg:table-cell">Criada</th>
            <th className="px-4 py-3 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium">{list.name}</span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={list.type === 'dynamic' ? 'secondary' : 'outline'} className="flex items-center gap-1 w-fit">
                  {list.type === 'dynamic' ? (
                    <><Filter className="h-3 w-3" /> Dinâmica</>
                  ) : (
                    <><Users className="h-3 w-3" /> Manual</>
                  )}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {list.contact_count}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                  {list.description || '—'}
                </span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(list.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(list)}>
                      <Eye className="h-4 w-4 mr-2" /> Ver contatos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(list)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSend(list)}>
                      <Send className="h-4 w-4 mr-2" /> Enviar mensagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(list)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
