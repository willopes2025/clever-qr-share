import { Handle, Position, NodeProps } from "@xyflow/react";
import { Tag, ArrowRightLeft, Variable, UserPlus, Globe } from "lucide-react";

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  add_tag: Tag,
  remove_tag: Tag,
  move_funnel: ArrowRightLeft,
  set_variable: Variable,
  transfer: UserPlus,
  http_request: Globe,
};

const actionLabels: Record<string, string> = {
  add_tag: "Adicionar Tag",
  remove_tag: "Remover Tag",
  move_funnel: "Mover Funil",
  set_variable: "Definir Variável",
  transfer: "Transferir",
  http_request: "HTTP Request",
};

export const ActionNode = ({ data, selected }: NodeProps) => {
  const actionType = (data?.actionType as string) || "add_tag";
  const Icon = actionIcons[actionType] || Tag;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[160px]
        ${selected ? "border-pink-500 ring-2 ring-pink-500/20" : "border-border"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-pink-500">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{actionLabels[actionType]}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-pink-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
