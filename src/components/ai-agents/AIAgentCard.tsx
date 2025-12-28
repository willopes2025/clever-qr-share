import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bot, MoreVertical, Pencil, Copy, Trash2, Target, Send, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AI_AGENT_TEMPLATES } from "@/data/ai-agent-templates";

interface AIAgentCardProps {
  agent: {
    id: string;
    agent_name: string;
    is_active: boolean | null;
    template_type?: string | null;
    personality_prompt: string | null;
    funnel_id?: string | null;
    campaign_id?: string | null;
  };
  onEdit: () => void;
  onRefresh: () => void;
}

export const AIAgentCard = ({ agent, onEdit, onRefresh }: AIAgentCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const template = agent.template_type 
    ? AI_AGENT_TEMPLATES.find(t => t.id === agent.template_type) 
    : null;

  const getUsageInfo = () => {
    const uses = [];
    if (agent.funnel_id) uses.push({ icon: Target, label: "Funil" });
    if (agent.campaign_id) uses.push({ icon: Send, label: "Campanha" });
    return uses;
  };

  const usageInfo = getUsageInfo();

  const handleToggleActive = async (checked: boolean) => {
    setIsTogglingActive(true);
    try {
      const { error } = await supabase
        .from("ai_agent_configs")
        .update({ is_active: checked })
        .eq("id", agent.id);

      if (error) throw error;
      toast.success(checked ? "Agente ativado!" : "Agente desativado");
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { data: original, error: fetchError } = await supabase
        .from("ai_agent_configs")
        .select("*")
        .eq("id", agent.id)
        .single();

      if (fetchError) throw fetchError;

      const { id, created_at, updated_at, funnel_id, campaign_id, ...configData } = original;
      
      const { error: insertError } = await supabase
        .from("ai_agent_configs")
        .insert({
          ...configData,
          agent_name: `${original.agent_name} (Cópia)`,
          is_active: false,
        });

      if (insertError) throw insertError;
      toast.success("Agente duplicado com sucesso!");
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao duplicar: " + error.message);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("ai_agent_configs")
        .delete()
        .eq("id", agent.id);

      if (error) throw error;
      toast.success("Agente excluído com sucesso!");
      onRefresh();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                {template?.icon || "🤖"}
              </div>
              <div>
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {agent.agent_name}
                </h3>
                {template && (
                  <p className="text-xs text-muted-foreground">{template.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={agent.is_active ?? false}
                onCheckedChange={handleToggleActive}
                disabled={isTogglingActive}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.personality_prompt && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {agent.personality_prompt.substring(0, 100)}...
            </p>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={agent.is_active ? "default" : "secondary"}>
              {agent.is_active ? "Ativo" : "Inativo"}
            </Badge>
            
            {usageInfo.length > 0 ? (
              usageInfo.map((use, index) => (
                <Badge key={index} variant="outline" className="gap-1">
                  <use.icon className="h-3 w-3" />
                  {use.label}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Não vinculado
              </Badge>
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Configurar Agente
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agente "{agent.agent_name}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
