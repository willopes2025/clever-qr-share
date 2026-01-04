import { useState } from "react";
import { 
  MessageCircle, 
  Clock, 
  Bot, 
  Zap, 
  FileInput, 
  Tag, 
  UserPlus, 
  ArrowRightLeft,
  Webhook,
  Copy,
  GripVertical,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Send,
  Bell,
  FileText,
  DollarSign,
  User,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FunnelAutomation } from "@/hooks/useFunnels";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AutomationCardProps {
  automation: FunnelAutomation;
  onEdit: (automation: FunnelAutomation) => void;
  onDelete: (automation: FunnelAutomation) => void;
  onToggleActive: (automation: FunnelAutomation) => void;
  onCopy: (automation: FunnelAutomation) => void;
  isDragging?: boolean;
}

const triggerIcons: Record<string, React.ReactNode> = {
  on_stage_enter: <Zap className="h-4 w-4" />,
  on_stage_exit: <ArrowRightLeft className="h-4 w-4" />,
  on_deal_won: <CheckCircle2 className="h-4 w-4" />,
  on_deal_lost: <XCircle className="h-4 w-4" />,
  on_time_in_stage: <Clock className="h-4 w-4" />,
  on_message_received: <MessageCircle className="h-4 w-4" />,
  on_keyword_received: <MessageCircle className="h-4 w-4" />,
  on_contact_created: <UserPlus className="h-4 w-4" />,
  on_tag_added: <Tag className="h-4 w-4" />,
  on_tag_removed: <Tag className="h-4 w-4" />,
  on_inactivity: <Clock className="h-4 w-4" />,
  on_deal_value_changed: <DollarSign className="h-4 w-4" />,
  on_custom_field_changed: <FileText className="h-4 w-4" />,
  on_webhook: <Webhook className="h-4 w-4" />,
  on_form_submission: <FileInput className="h-4 w-4" />,
};

const triggerLabels: Record<string, string> = {
  on_stage_enter: "Quando entrar",
  on_stage_exit: "Quando sair",
  on_deal_won: "Quando ganho",
  on_deal_lost: "Quando perdido",
  on_time_in_stage: "Após tempo na etapa",
  on_message_received: "Em msg recebida",
  on_keyword_received: "Palavra-chave",
  on_contact_created: "Novo contato",
  on_tag_added: "Tag adicionada",
  on_tag_removed: "Tag removida",
  on_inactivity: "Inatividade",
  on_deal_value_changed: "Valor alterado",
  on_custom_field_changed: "Campo alterado",
  on_webhook: "Webhook",
  on_form_submission: "Formulário enviado",
};

const actionIcons: Record<string, React.ReactNode> = {
  send_message: <MessageCircle className="h-3 w-3" />,
  send_template: <Send className="h-3 w-3" />,
  add_tag: <Tag className="h-3 w-3" />,
  remove_tag: <Tag className="h-3 w-3" />,
  notify_user: <Bell className="h-3 w-3" />,
  move_stage: <ArrowRightLeft className="h-3 w-3" />,
  trigger_chatbot_flow: <Bot className="h-3 w-3" />,
  set_custom_field: <FileText className="h-3 w-3" />,
  set_deal_value: <DollarSign className="h-3 w-3" />,
  change_responsible: <User className="h-3 w-3" />,
  add_note: <FileText className="h-3 w-3" />,
  webhook_request: <Webhook className="h-3 w-3" />,
  create_task: <CheckCircle2 className="h-3 w-3" />,
  close_deal_won: <CheckCircle2 className="h-3 w-3" />,
  close_deal_lost: <XCircle className="h-3 w-3" />,
  ai_analyze_and_move: <Bot className="h-3 w-3" />,
};

const actionLabels: Record<string, string> = {
  send_message: "Enviar mensagem",
  send_template: "Enviar template",
  add_tag: "Adicionar tag",
  remove_tag: "Remover tag",
  notify_user: "Notificar",
  move_stage: "Mover etapa",
  trigger_chatbot_flow: "Executar robô",
  set_custom_field: "Definir campo",
  set_deal_value: "Definir valor",
  change_responsible: "Alterar responsável",
  add_note: "Adicionar nota",
  webhook_request: "Enviar webhook",
  create_task: "Criar tarefa",
  close_deal_won: "Fechar ganho",
  close_deal_lost: "Fechar perdido",
  ai_analyze_and_move: "IA analisa e move",
};

const triggerColors: Record<string, string> = {
  on_stage_enter: "border-l-blue-500",
  on_stage_exit: "border-l-purple-500",
  on_deal_won: "border-l-green-500",
  on_deal_lost: "border-l-red-500",
  on_time_in_stage: "border-l-amber-500",
  on_message_received: "border-l-emerald-500",
  on_keyword_received: "border-l-emerald-500",
  on_contact_created: "border-l-indigo-500",
  on_tag_added: "border-l-pink-500",
  on_tag_removed: "border-l-pink-500",
  on_inactivity: "border-l-orange-500",
  on_deal_value_changed: "border-l-yellow-500",
  on_custom_field_changed: "border-l-cyan-500",
  on_webhook: "border-l-slate-500",
  on_form_submission: "border-l-violet-500",
};

export const AutomationCard = ({
  automation,
  onEdit,
  onDelete,
  onToggleActive,
  onCopy,
  isDragging = false,
}: AutomationCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const triggerConfig = automation.trigger_config as Record<string, unknown> || {};
  
  // Build trigger subtitle
  const getTriggerSubtitle = () => {
    if (automation.trigger_type === 'on_time_in_stage' && triggerConfig.days) {
      return `${triggerConfig.days}d na etapa`;
    }
    if (automation.trigger_type === 'on_inactivity' && triggerConfig.days) {
      return `${triggerConfig.days}d sem interação`;
    }
    if (automation.trigger_type === 'on_keyword_received' && triggerConfig.keywords) {
      return String(triggerConfig.keywords).split(',')[0] + '...';
    }
    return null;
  };

  const triggerSubtitle = getTriggerSubtitle();

  return (
    <div
      className={cn(
        "group relative bg-card rounded-lg border-l-4 shadow-sm transition-all duration-200",
        "hover:shadow-md cursor-pointer",
        triggerColors[automation.trigger_type] || "border-l-gray-500",
        !automation.is_active && "opacity-60",
        isDragging && "shadow-lg rotate-2 scale-105"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(automation)}
    >
      {/* Drag handle */}
      <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="p-3 pl-6">
        {/* Header with trigger */}
        <div className="flex items-start gap-2 mb-2">
          <div className={cn(
            "p-1.5 rounded-md",
            automation.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {triggerIcons[automation.trigger_type] || <Zap className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {triggerLabels[automation.trigger_type] || automation.trigger_type}
            </p>
            {triggerSubtitle && (
              <p className="text-[10px] text-muted-foreground/70">{triggerSubtitle}</p>
            )}
          </div>
          {!automation.is_active && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              Inativo
            </Badge>
          )}
        </div>

        {/* Action */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">
            {actionIcons[automation.action_type]}
          </span>
          <span className="font-medium truncate">
            {actionLabels[automation.action_type] || automation.action_type}
          </span>
        </div>

        {/* Name */}
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {automation.name}
        </p>
      </div>

      {/* Hover actions */}
      <TooltipProvider>
        <div className={cn(
          "absolute right-1 top-1 flex items-center gap-0.5 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(automation);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleActive(automation);
                }}
              >
                {automation.is_active ? (
                  <PowerOff className="h-3 w-3" />
                ) : (
                  <Power className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {automation.is_active ? "Desativar" : "Ativar"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(automation);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(automation);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
};
