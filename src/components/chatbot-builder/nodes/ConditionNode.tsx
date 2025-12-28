import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch, Bot } from "lucide-react";

export const ConditionNode = ({ data, selected }: NodeProps) => {
  const isAIMode = data?.conditionMode === 'ai_intent';
  
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px]
        ${selected 
          ? isAIMode 
            ? "border-purple-500 ring-2 ring-purple-500/20" 
            : "border-yellow-500 ring-2 ring-yellow-500/20" 
          : "border-border"
        }
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 !border-background ${isAIMode ? '!bg-purple-500' : '!bg-yellow-500'}`}
      />
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${isAIMode ? 'bg-purple-500' : 'bg-yellow-500'}`}>
          {isAIMode ? (
            <Bot className="h-4 w-4 text-white" />
          ) : (
            <GitBranch className="h-4 w-4 text-white" />
          )}
        </div>
        <span className="font-medium text-sm">
          {isAIMode ? 'Condição IA' : 'Condição'}
        </span>
      </div>
      
      {isAIMode ? (
        data?.intentDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            "{data.intentDescription as string}"
          </p>
        )
      ) : (
        data?.variable && (
          <p className="text-xs text-muted-foreground">
            {data.variable as string} {data.operator as string} {data.value as string}
          </p>
        )
      )}
      
      <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
        <span className="text-green-500">Sim</span>
        <span className="text-red-500">Não</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-background !left-[30%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-background !left-[70%]"
      />
    </div>
  );
};
