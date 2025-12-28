import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";

export const AIResponseNode = ({ data, selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[160px] max-w-[250px]
        ${selected ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-border"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-cyan-500">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Resposta IA</span>
      </div>
      {data?.prompt && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {data.prompt as string}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
