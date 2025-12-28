import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bot, Sparkles } from "lucide-react";

interface AIResponseNodeData {
  prompt?: string;
  aiMode?: 'existing' | 'custom';
  aiConfigId?: string;
  aiAgentName?: string;
}

export const AIResponseNode = ({ data, selected }: NodeProps) => {
  const nodeData = data as AIResponseNodeData;
  const isUsingExistingAI = nodeData?.aiMode === 'existing' && nodeData?.aiConfigId;

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
      
      {isUsingExistingAI ? (
        <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400">
          <Sparkles className="h-3 w-3" />
          <span className="font-medium">IA vinculada</span>
        </div>
      ) : nodeData?.prompt ? (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {nodeData.prompt}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Configure a IA...
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
