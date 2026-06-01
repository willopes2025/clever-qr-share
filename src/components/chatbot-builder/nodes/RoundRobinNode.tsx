import { Handle, Position, NodeProps } from "@xyflow/react";
import { RefreshCw, Trash2 } from "lucide-react";

interface RoundRobinOutput {
  id: string;
  label: string;
}

export const RoundRobinNode = ({ data, selected }: NodeProps) => {
  // New model: rotate between configured outputs (any downstream branch).
  // Backward compat: if legacy `members` exists and no `outputs`, derive outputs from members count.
  const legacyMembers = (data?.members as string[]) || [];
  let outputs = (data?.outputs as RoundRobinOutput[]) || [];
  if (outputs.length === 0) {
    if (legacyMembers.length > 0) {
      outputs = legacyMembers.map((m, i) => ({ id: `out_${i + 1}`, label: m || `Saída ${i + 1}` }));
    } else {
      outputs = [
        { id: "out_1", label: "Saída 1" },
        { id: "out_2", label: "Saída 2" },
      ];
    }
  }

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[200px] relative
        ${selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border"}
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
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-amber-500">
          <RefreshCw className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-medium text-sm block">Round Robin</span>
          <span className="text-xs text-muted-foreground">
            {outputs.length} {outputs.length === 1 ? "saída" : "saídas"} em rodízio
          </span>
        </div>
      </div>

      {/* Output labels list */}
      <div className="mt-3 space-y-1">
        {outputs.map((out, idx) => (
          <div
            key={out.id}
            className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/50"
          >
            <span className="text-muted-foreground">#{idx + 1}</span>
            <span className="font-medium truncate ml-2">{out.label || `Saída ${idx + 1}`}</span>
          </div>
        ))}
      </div>

      {/* Distribute handles evenly along the bottom */}
      {outputs.map((out, idx) => {
        const left = ((idx + 1) / (outputs.length + 1)) * 100;
        return (
          <Handle
            key={out.id}
            id={out.id}
            type="source"
            position={Position.Bottom}
            style={{ left: `${left}%` }}
            className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
          />
        );
      })}
    </div>
  );
};
