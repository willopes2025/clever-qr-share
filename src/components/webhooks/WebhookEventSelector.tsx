import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { WEBHOOK_EVENTS } from "@/hooks/useWebhookConfig";
import { cn } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (events: string[]) => void;
  disabled?: boolean;
}

export function WebhookEventSelector({ selected, onChange, disabled }: Props) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((e) => e !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
            disabled={disabled}
          >
            {selected.length === 0
              ? "Selecionar eventos..."
              : `${selected.length} evento(s) selecionado(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar evento..." />
            <CommandList>
              <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
              <CommandGroup>
                {WEBHOOK_EVENTS.map((evt) => (
                  <CommandItem
                    key={evt.value}
                    value={evt.value}
                    onSelect={() => toggle(evt.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(evt.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {evt.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {evt.value}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((evt) => {
            const label = WEBHOOK_EVENTS.find((e) => e.value === evt)?.label ?? evt;
            return (
              <Badge
                key={evt}
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => toggle(evt)}
              >
                {label} ×
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
