import { Handle, Position, NodeProps } from "@xyflow/react";
import { MousePointerClick, Trash2 } from "lucide-react";

interface ButtonItem {
  id?: string;
  label: string;
}

export const ButtonsNode = ({ data, selected }: NodeProps) => {
  const buttons = (data?.buttons as ButtonItem[]) || [];
  const message = (data?.message as string) || "";

  // Layout: each button + 3 fallback handles spaced along the bottom edge
  const fallbackHandles = [
    { id: "other", label: "Outra resposta", color: "#9ca3af" },
    { id: "timeout", label: "Sem resposta", color: "#f59e0b" },
    { id: "failed", label: "Falha ao enviar", color: "#ef4444" },
  ];
  const totalHandles = buttons.length + fallbackHandles.length;

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[240px] max-w-[280px] relative ${
        selected ? "border-sky-500 ring-2 ring-sky-500/20" : "border-border"
      }`}
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
        className="!bg-sky-500 !w-3 !h-3 !border-2 !border-background"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-sky-500">
          <MousePointerClick className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Botões</span>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{message}</p>
      )}

      <div className="space-y-1">
        {buttons.map((btn, i) => (
          <div
            key={i}
            className="text-xs px-2 py-1 rounded border border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300 truncate"
          >
            {i + 1}. {btn.label || `Botão ${i + 1}`}
          </div>
        ))}
        {buttons.length === 0 && (
          <div className="text-xs text-muted-foreground italic">Sem botões configurados</div>
        )}
      </div>

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

      {/* Bottom handles: one per button + fallback handles */}
      {buttons.map((_, i) => {
        const left = `${((i + 1) / (totalHandles + 1)) * 100}%`;
        return (
          <Handle
            key={`btn_${i}`}
            id={`btn_${i}`}
            type="source"
            position={Position.Bottom}
            style={{ left, background: "#0ea5e9" }}
            className="!w-3 !h-3 !border-2 !border-background"
          />
        );
      })}
      {fallbackHandles.map((h, idx) => {
        const left = `${((buttons.length + idx + 1) / (totalHandles + 1)) * 100}%`;
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
