import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, User, FileText, Target, DollarSign } from "lucide-react";
import { useCustomFields } from "@/hooks/useCustomFields";

interface VariableChipsSelectorProps {
  onInsert: (variable: string) => void;
  compact?: boolean;
}

export const VariableChipsSelector = ({ onInsert, compact = false }: VariableChipsSelectorProps) => {
  const { contactFieldDefinitions, leadFieldDefinitions } = useCustomFields();

  const staticVariables = [
    { key: 'nome', label: 'Nome completo do contato' },
    { key: 'primeiro_nome', label: 'Primeiro nome do contato' },
    { key: 'telefone', label: 'Telefone do contato' },
    { key: 'email', label: 'Email do contato' },
  ];

  const dealVariables = [
    { key: 'valor', label: 'Valor da venda' },
    { key: 'etapa', label: 'Etapa atual' },
    { key: 'funil', label: 'Nome do funil' },
  ];

  const contactCustomVars = contactFieldDefinitions?.map(f => ({
    key: f.field_key,
    label: f.field_name,
  })) || [];

  const leadCustomVars = leadFieldDefinitions?.map(f => ({
    key: f.field_key,
    label: f.field_name,
  })) || [];

  const chipClass = compact
    ? "text-[10px] cursor-pointer px-1.5 py-0"
    : "text-xs cursor-pointer px-2 py-0.5";

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
        <User className="h-3 w-3" /> Contato
      </p>
      <div className="flex flex-wrap gap-1">
        {staticVariables.map((v) => (
          <Badge
            key={v.key}
            variant="secondary"
            className={`bg-primary/15 text-primary border-primary/25 hover:bg-primary/25 ${chipClass}`}
            title={v.label}
            onClick={() => onInsert(`{{${v.key}}}`)}
          >
            {`{{${v.key}}}`}
          </Badge>
        ))}
      </div>

      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mt-2">
        <DollarSign className="h-3 w-3" /> Lead
      </p>
      <div className="flex flex-wrap gap-1">
        {dealVariables.map((v) => (
          <Badge
            key={v.key}
            variant="secondary"
            className={`bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25 hover:bg-orange-500/25 ${chipClass}`}
            title={v.label}
            onClick={() => onInsert(`{{${v.key}}}`)}
          >
            {`{{${v.key}}}`}
          </Badge>
        ))}
      </div>

      {contactCustomVars.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            <FileText className="h-3 w-3" />
            Campos de Contato ({contactCustomVars.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <div className="flex flex-wrap gap-1">
              {contactCustomVars.map((v) => (
                <Badge
                  key={v.key}
                  variant="secondary"
                  className={`bg-secondary/60 text-secondary-foreground border-border hover:bg-secondary ${chipClass}`}
                  title={v.label}
                  onClick={() => onInsert(`{{${v.key}}}`)}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {leadCustomVars.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full group">
            <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            <Target className="h-3 w-3" />
            Campos de Lead ({leadCustomVars.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <div className="flex flex-wrap gap-1">
              {leadCustomVars.map((v) => (
                <Badge
                  key={v.key}
                  variant="secondary"
                  className={`bg-accent/60 text-accent-foreground border-border hover:bg-accent ${chipClass}`}
                  title={v.label}
                  onClick={() => onInsert(`{{${v.key}}}`)}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
