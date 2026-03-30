import { Handle, Position, NodeProps } from "@xyflow/react";
import { ShieldCheck, Trash2 } from "lucide-react";

const validationLabels: Record<string, string> = {
  email: "E-mail",
  phone: "Telefone",
  cpf: "CPF",
  number: "Número",
  not_empty: "Não vazio",
  regex: "Regex",
};

export const ValidationNode = ({ data, selected }: NodeProps) => {
  const validationType = (data?.validationType as string) || "not_empty";

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 bg-card shadow-lg min-w-[160px] relative
        ${selected ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"}
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
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-emerald-500">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div>
          <span className="font-medium text-sm block">Validação</span>
          <span className="text-xs text-muted-foreground">{validationLabels[validationType] || validationType}</span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="valid"
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background !left-[30%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="invalid"
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-background !left-[70%]"
      />
    </div>
  );
};
