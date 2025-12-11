import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Filter, MoreVertical, Pencil, Trash2, Eye, Send } from "lucide-react";
import { BroadcastListWithContacts } from "@/hooks/useBroadcastLists";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BroadcastListCardProps {
  list: BroadcastListWithContacts;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
}

export const BroadcastListCard = ({
  list,
  onView,
  onEdit,
  onDelete,
  onSend,
}: BroadcastListCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {list.name}
              <Badge variant={list.type === "dynamic" ? "secondary" : "outline"}>
                {list.type === "dynamic" ? (
                  <>
                    <Filter className="h-3 w-3 mr-1" />
                    Dinâmica
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3 mr-1" />
                    Manual
                  </>
                )}
              </Badge>
            </CardTitle>
            {list.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {list.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                Ver contatos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSend}>
                <Send className="h-4 w-4 mr-2" />
                Enviar mensagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{list.contact_count} contatos</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Criada {formatDistanceToNow(new Date(list.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
