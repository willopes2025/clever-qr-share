import { Handle, Position, NodeProps } from "@xyflow/react";
import { List, Trash2 } from "lucide-react";

export const ListMessageNode = ({ data, selected }: NodeProps) => {
  const items = (data?.items as Array<{ title: string }>) || [];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px] relative
        ${selected ? "border-green-600 ring-2 ring-green-600/20" : "border-border"}
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
        className="!bg-green-600 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-green-600">
          <List className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">List Message</span>
      </div>
      {items.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="truncate">• {item.title || "Item"}</div>
          ))}
          {items.length > 3 && (
            <div className="text-muted-foreground/60">+{items.length - 3} mais</div>
          )}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-600 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
