import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquare, FileText, Send, Trash2 } from "lucide-react";

interface MetaTplButton { type: string; text: string }

export const MessageNode = ({ data, selected }: NodeProps) => {
  const messageMode = (data?.messageMode as string) || 'text';
  const modeLabel = messageMode === 'template' ? 'Template' : messageMode === 'meta_template' ? 'Template Meta' : 'Mensagem';
  const ModeIcon = messageMode === 'template' ? FileText : messageMode === 'meta_template' ? Send : MessageSquare;

  // Effective interactive buttons (only QUICK_REPLY routes the flow)
  const textButtons = ((data?.buttons as Array<{ label: string }>) || []).filter(b => b?.label?.trim());
  const metaButtons = (((data?.config as any)?.metaTemplateButtons as MetaTplButton[]) || [])
    .filter(b => b?.type === 'QUICK_REPLY');

  const effectiveButtons: Array<{ label: string }> =
    messageMode === 'meta_template'
      ? metaButtons.map(b => ({ label: b.text }))
      : messageMode === 'text'
        ? textButtons
        : [];

  const hasButtons = effectiveButtons.length > 0;
  const fallbackHandles = hasButtons
    ? [
        { id: "other", label: "Outra resposta", color: "#9ca3af" },
        { id: "timeout", label: "Sem resposta", color: "#f59e0b" },
        { id: "failed", label: "Falha ao enviar", color: "#ef4444" },
      ]
    : [];
  const totalHandles = effectiveButtons.length + fallbackHandles.length;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[200px] max-w-[260px] relative
        ${selected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border"}
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
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-blue-500">
          <ModeIcon className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">{modeLabel}</span>
      </div>
      {data?.message && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.message as string}
        </p>
      )}
      {messageMode === 'meta_template' && (data?.config as any)?.metaTemplateName && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          📋 {(data.config as any).metaTemplateName}
        </p>
      )}

      {hasButtons && (
        <div className="mt-2 space-y-1">
          {effectiveButtons.map((b, i) => (
            <div
              key={i}
              className="text-xs px-2 py-1 rounded border border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300 truncate"
            >
              {i + 1}. {b.label || `Botão ${i + 1}`}
            </div>
          ))}
          <div className="pt-1 border-t border-border space-y-0.5">
            {fallbackHandles.map((h) => (
              <div key={h.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
                {h.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasButtons && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
        />
      )}

      {hasButtons && effectiveButtons.map((_, i) => {
        const left = `${((i + 1) / (totalHandles + 1)) * 100}%`;
        return (
          <Handle
            key={`btn_${i}`}
            id={`btn_${i}`}
            type="source"
            position={Position.Bottom}
            style={{ left, background: "#3b82f6" }}
            className="!w-3 !h-3 !border-2 !border-background"
          />
        );
      })}
      {hasButtons && fallbackHandles.map((h, idx) => {
        const left = `${((effectiveButtons.length + idx + 1) / (totalHandles + 1)) * 100}%`;
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
