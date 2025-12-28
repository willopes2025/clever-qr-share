import { Handle, Position, NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";

export const EndNode = ({ selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[140px]
        ${selected ? "border-red-500 ring-2 ring-red-500/20" : "border-red-500/50"}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-red-500">
          <Square className="h-4 w-4 text-white" />
        </div>
        <span className="font-medium text-sm">Fim</span>
      </div>
    </div>
  );
};
