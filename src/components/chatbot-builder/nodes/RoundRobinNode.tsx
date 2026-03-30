import { Handle, Position, NodeProps } from "@xyflow/react";
import { RefreshCw, Trash2 } from "lucide-react";

export const RoundRobinNode = ({ data, selected }: NodeProps) => {
  const members = (data?.members as string[]) || [];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[160px] relative
        ${selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border"}
      `}
    >
      {data?.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            (data.onDelete as () => void)();
          }}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-card border shadow-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500">
          <RefreshCw className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-medium text-sm block">Round Robin</span>
          {members.length > 0 && (
            <span className="text-xs text-muted-foreground">{members.length} membros</span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
