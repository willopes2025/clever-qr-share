import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch, Bot, Trash2 } from "lucide-react";

interface ConditionItem {
  id: string;
  variable: string;
  operator: string;
  value: string;
}

interface IntentItem {
  id: string;
  label: string;
  description: string;
}

export const ConditionNode = ({ data, selected }: NodeProps) => {
  const isAIMode = data?.conditionMode === 'ai_intent';
  const intents = (data?.intents as IntentItem[]) || [];
  const conditions = (data?.conditions as ConditionItem[]) || [];
  const logicOperator = (data?.logicOperator as string) || 'and';
  
  // For AI mode, generate handles based on intents
  const hasMultipleIntents = isAIMode && intents.length > 0;
  const validIntents = intents.filter(i => i.label && i.description);
  
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[180px] relative
        ${selected 
          ? isAIMode 
            ? "border-purple-500 ring-2 ring-purple-500/20" 
            : "border-yellow-500 ring-2 ring-yellow-500/20" 
          : "border-border"
        }
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
        // AI Mode: show intents summary
        <div className="space-y-1">
          {validIntents.length > 0 ? (
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {validIntents.length} {validIntents.length === 1 ? 'intenção' : 'intenções'}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma intenção configurada
            </p>
          )}
        </div>
      ) : (
        // Variable Mode: show conditions summary
        <div className="space-y-1">
          {conditions.length > 0 && conditions[0].variable ? (
            <p className="text-xs text-muted-foreground">
              {conditions.length} {conditions.length === 1 ? 'condição' : 'condições'} ({logicOperator.toUpperCase()})
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma condição configurada
            </p>
          )}
        </div>
      )}
      
      {/* Output handles */}
      {isAIMode && validIntents.length > 0 ? (
        // AI Mode: Dynamic handles for each intent + fallback
        <>
          <div className="flex flex-wrap gap-1 mt-3 mb-1">
            {validIntents.map((intent, index) => (
              <span 
                key={intent.id} 
                className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400 truncate max-w-[60px]"
                title={intent.label}
              >
                {intent.label}
              </span>
            ))}
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Nenhuma
            </span>
          </div>
          
          {/* Render handles for each intent */}
          {validIntents.map((intent, index) => {
            const totalHandles = validIntents.length + 1; // +1 for "none" handle
            const position = ((index + 1) / (totalHandles + 1)) * 100;
            return (
              <Handle
                key={intent.id}
                type="source"
                position={Position.Bottom}
                id={intent.id}
                className="!bg-purple-500 !w-2.5 !h-2.5 !border-2 !border-background"
                style={{ left: `${position}%` }}
              />
            );
          })}
          {/* Fallback "none" handle */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="none"
            className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-background"
            style={{ left: `${((validIntents.length + 1) / (validIntents.length + 2)) * 100}%` }}
          />
        </>
      ) : (
        // Variable Mode or empty AI: Simple Yes/No handles
        <>
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
        </>
      )}
    </div>
  );
};
