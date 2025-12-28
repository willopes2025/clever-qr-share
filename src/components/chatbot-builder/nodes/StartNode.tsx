import { Handle, Position, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";

export const StartNode = ({ selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[140px]
        ${selected ? "border-green-500 ring-2 ring-green-500/20" : "border-green-500/50"}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-green-500">
          <Play className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Início</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
};
