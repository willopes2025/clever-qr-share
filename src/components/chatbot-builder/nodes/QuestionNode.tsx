import { Handle, Position, NodeProps } from "@xyflow/react";
import { HelpCircle, Trash2 } from "lucide-react";

export const QuestionNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px] max-w-[250px] relative
        ${selected ? "border-purple-500 ring-2 ring-purple-500/20" : "border-border"}
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
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-purple-500">
          <HelpCircle className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Pergunta</span>
      </div>
      {data?.question && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.question as string}
        </p>
      )}
      {data?.variable && (
        <p className="text-xs text-purple-500 mt-1">
          → {data.variable as string}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
