import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCustomFields } from "@/hooks/useCustomFields";
import { cn } from "@/lib/utils";

interface VariableOption {
  key: string;
  label: string;
  description?: string;
}

interface VariableGroup {
  label: string;
  options: VariableOption[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SYSTEM_GROUPS: VariableGroup[] = [
  {
    label: "Mensagem",
    options: [
      { key: "_last_input", label: "Última mensagem do cliente", description: "Texto da última resposta recebida" },
      { key: "_last_message_type", label: "Tipo da última mensagem", description: "text, image, audio, video, document, sticker, location" },
      { key: "_last_message_has_media", label: "Última mensagem tem mídia", description: "true / false" },
    ],
  },
  {
    label: "Conversa",
    options: [
      { key: "_conversation_id", label: "Código do chat ativo" },
      { key: "_conversation_status", label: "Status da conversa", description: "open, pending, resolved" },
      { key: "_conversation_channel", label: "Canal do chat ativo", description: "whatsapp_evolution, whatsapp_meta, instagram, messenger" },
      { key: "_conversation_instance_name", label: "Mensageiro / Instância ativa", description: "Nome da instância ou número Meta" },
      { key: "_conversation_phone_number", label: "Número receptor (Meta/Evolution)" },
      { key: "_conversation_assigned_to", label: "Responsável atribuído" },
      { key: "_conversation_unread_count", label: "Mensagens não lidas" },
    ],
  },
  {
    label: "Contato",
    options: [
      { key: "nome", label: "Nome completo" },
      { key: "primeiro_nome", label: "Primeiro nome" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "E-mail" },
    ],
  },
  {
    label: "Lead / Negócio",
    options: [
      { key: "valor", label: "Valor da venda" },
      { key: "titulo", label: "Título do lead" },
      { key: "etapa", label: "Etapa atual" },
      { key: "funil", label: "Funil atual" },
      { key: "_lead_source", label: "Fonte do lead", description: "Canal/origem que gerou o lead" },
      { key: "_lead_source_phone", label: "Telefone de origem do lead" },
    ],
  },
  {
    label: "Data e hora",
    options: [
      { key: "_now_date", label: "Data atual (AAAA-MM-DD)" },
      { key: "_now_time", label: "Hora atual (HH:mm)" },
      { key: "_now_weekday", label: "Dia da semana", description: "monday..sunday" },
    ],
  },
];

export const ConditionVariablePicker = ({ value, onChange, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const { contactFieldDefinitions, leadFieldDefinitions } = useCustomFields();

  const groups = useMemo<VariableGroup[]>(() => {
    const dynamic: VariableGroup[] = [];
    if (contactFieldDefinitions?.length) {
      dynamic.push({
        label: "Campos de Contato",
        options: contactFieldDefinitions.map((f) => ({ key: f.field_key, label: f.field_name })),
      });
    }
    if (leadFieldDefinitions?.length) {
      dynamic.push({
        label: "Campos de Lead",
        options: leadFieldDefinitions.map((f) => ({ key: f.field_key, label: f.field_name })),
      });
    }
    return [...SYSTEM_GROUPS, ...dynamic];
  }, [contactFieldDefinitions, leadFieldDefinitions]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    for (const g of groups) {
      const opt = g.options.find((o) => o.key === value);
      if (opt) return opt.label;
    }
    return value;
  }, [value, groups]);

  if (customMode) {
    return (
      <div className={cn("flex gap-1", className)}>
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="nome_da_variavel"
          className="h-8 text-sm font-mono"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setCustomMode(false)}
        >
          Lista
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-8 w-full justify-between text-sm font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? selectedLabel : "Selecionar variável"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar variável..." className="h-9" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>Nenhuma variável encontrada.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.options.map((opt) => (
                  <CommandItem
                    key={opt.key}
                    value={`${group.label} ${opt.label} ${opt.key}`}
                    onSelect={() => {
                      onChange(opt.key);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-1 h-3.5 w-3.5 shrink-0",
                        value === opt.key ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        {`{{${opt.key}}}`}
                        {opt.description ? ` · ${opt.description}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandGroup heading="Avançado">
              <CommandItem
                value="custom-variable"
                onSelect={() => {
                  setCustomMode(true);
                  setOpen(false);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                <span className="text-sm">Digitar nome de variável manualmente…</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
