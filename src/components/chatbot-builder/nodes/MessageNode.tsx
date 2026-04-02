import { Handle, Position, NodeProps } from "@xyflow/react";
import { MessageSquare, FileText, Send, Trash2 } from "lucide-react";

export const MessageNode = ({ data, selected }: NodeProps) => {
  const messageMode = (data?.messageMode as string) || 'text';
  const modeLabel = messageMode === 'template' ? 'Template' : messageMode === 'meta_template' ? 'Template Meta' : 'Mensagem';
  const ModeIcon = messageMode === 'template' ? FileText : messageMode === 'meta_template' ? Send : MessageSquare;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px] max-w-[250px] relative
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
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
