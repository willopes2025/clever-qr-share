import { MessageSquare, GitBranch, Clock, Bot, Tag, Play, Square, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const nodeCategories = [
  {
    label: "Controle",
    nodes: [
      { type: "start", label: "Início", icon: Play, color: "bg-green-500" },
      { type: "end", label: "Fim", icon: Square, color: "bg-red-500" },
    ],
  },
  {
    label: "Mensagens",
    nodes: [
      { type: "message", label: "Mensagem", icon: MessageSquare, color: "bg-blue-500" },
      { type: "question", label: "Pergunta", icon: HelpCircle, color: "bg-purple-500" },
    ],
  },
  {
    label: "Lógica",
    nodes: [
      { type: "condition", label: "Condição", icon: GitBranch, color: "bg-yellow-500" },
      { type: "delay", label: "Aguardar", icon: Clock, color: "bg-orange-500" },
    ],
  },
  {
    label: "Inteligência",
    nodes: [
      { type: "ai_response", label: "IA", icon: Bot, color: "bg-cyan-500" },
    ],
  },
  {
    label: "Ações",
    nodes: [
      { type: "action", label: "Ação", icon: Tag, color: "bg-pink-500" },
    ],
  },
];

export const ChatbotFlowSidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-56 border-r border-border bg-card p-4 overflow-y-auto">
      <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">
        Componentes
      </h3>
      
      <div className="space-y-6">
        {nodeCategories.map((category) => (
          <div key={category.label}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {category.label}
            </h4>
            <div className="space-y-2">
              {category.nodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border",
                    "bg-background hover:bg-accent cursor-grab active:cursor-grabbing",
                    "transition-colors"
                  )}
                >
                  <div className={cn("p-1.5 rounded", node.color)}>
                    <node.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{node.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Dica:</p>
        <p>Arraste os componentes para o canvas para criar seu fluxo.</p>
      </div>
    </aside>
  );
};
