import { ChatbotFlow, useChatbotFlows } from "@/hooks/useChatbotFlows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Play, Pause, Trash2, Edit, GitBranch, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ChatbotFlowListProps {
  flows: ChatbotFlow[];
  isLoading: boolean;
  onSelect: (flow: ChatbotFlow) => void;
  onCreateNew: () => void;
}

export const ChatbotFlowList = ({ flows, isLoading, onSelect, onCreateNew }: ChatbotFlowListProps) => {
  const { deleteFlow, updateFlow } = useChatbotFlows();

  const handleToggleActive = (flow: ChatbotFlow) => {
    updateFlow.mutate({ id: flow.id, is_active: !flow.is_active });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="p-4 rounded-full bg-muted mb-4">
            <GitBranch className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhum fluxo criado</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie seu primeiro fluxo de chatbot para automatizar conversas
          </p>
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Fluxo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => (
        <Card 
          key={flow.id} 
          className="hover:border-primary/50 transition-colors cursor-pointer group"
          onClick={() => onSelect(flow)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{flow.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {flow.description || 'Sem descrição'}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(flow); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(flow); }}>
                    {flow.is_active ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Ativar
                      </>
                    )}
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onSelect={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O fluxo "{flow.name}" será excluído permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFlow.mutate(flow.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant={flow.is_active ? "default" : "secondary"}>
                {flow.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(flow.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
