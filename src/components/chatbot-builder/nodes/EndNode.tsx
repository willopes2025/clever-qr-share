import { Handle, Position, NodeProps } from "@xyflow/react";
import { Square, Trash2 } from "lucide-react";

export const EndNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[140px] relative
        ${selected ? "border-red-500 ring-2 ring-red-500/20" : "border-red-500/50"}
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
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-red-500">
          <Square className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Fim</span>
      </div>
    </div>
  );
};
