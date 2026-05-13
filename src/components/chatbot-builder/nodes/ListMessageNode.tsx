import { Handle, Position, NodeProps } from "@xyflow/react";
import { List, Trash2 } from "lucide-react";

export const ListMessageNode = ({ data, selected }: NodeProps) => {
  const items = (data?.items as Array<{ title: string }>) || [];

  const fallbackHandles = [
    { id: "other", label: "Outra resposta", color: "#9ca3af" },
    { id: "timeout", label: "Sem resposta", color: "#f59e0b" },
    { id: "failed", label: "Falha ao enviar", color: "#ef4444" },
  ];
  const totalHandles = items.length + fallbackHandles.length;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[220px] max-w-[280px] relative
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
      {items.length > 0 ? (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {items.map((item, i) => (
            <div key={i} className="truncate">
              {i + 1}. {item.title || "Item"}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Sem itens</div>
      )}

      <div className="mt-2 pt-2 border-t border-border space-y-0.5">
        {fallbackHandles.map((h) => (
          <div key={h.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: h.color }}
            />
            {h.label}
          </div>
        ))}
      </div>

      {items.map((_, i) => {
        const left = `${((i + 1) / (totalHandles + 1)) * 100}%`;
        return (
          <Handle
            key={`option_${i}`}
            id={`option_${i}`}
            type="source"
            position={Position.Bottom}
            style={{ left, background: "#16a34a" }}
            className="!w-3 !h-3 !border-2 !border-background"
          />
        );
      })}
      {fallbackHandles.map((h, idx) => {
        const left = `${((items.length + idx + 1) / (totalHandles + 1)) * 100}%`;
        return (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            position={Position.Bottom}
            style={{ left, background: h.color }}
            className="!w-3 !h-3 !border-2 !border-background"
          />
        );
      })}
    </div>
  );
};
