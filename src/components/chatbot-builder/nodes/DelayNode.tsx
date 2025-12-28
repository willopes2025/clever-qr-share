import { Handle, Position, NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";

export const DelayNode = ({ data, selected }: NodeProps) => {
  const duration = (data?.duration as number) || 5;
  const unit = (data?.unit as string) || "seconds";
  
  const unitLabels: Record<string, string> = {
    seconds: "s",
    minutes: "min",
    hours: "h",
  };

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[140px]
        ${selected ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-orange-500">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-medium text-sm">Aguardar</span>
          <p className="text-xs text-muted-foreground">
            {duration} {unitLabels[unit]}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
