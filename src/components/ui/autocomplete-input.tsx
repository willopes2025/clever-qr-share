import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteInputProps {
  placeholder?: string;
  emptyMessage?: string;
  options: AutocompleteOption[];
  value: string[];
  onChange: (value: string[]) => void;
  onSearch?: (term: string) => void;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
  minChars?: number;
}

export function AutocompleteInput({
  placeholder = "Pesquisar...",
  emptyMessage = "Nenhum resultado encontrado.",
  options,
  value,
  onChange,
  onSearch,
  multiple = true,
  className,
  disabled = false,
  minChars = 2,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleSelect = (selectedValue: string) => {
    if (multiple) {
      if (value.includes(selectedValue)) {
        onChange(value.filter((v) => v !== selectedValue));
      } else {
        onChange([...value, selectedValue]);
      }
    } else {
      onChange([selectedValue]);
      setOpen(false);
    }
  };

  const handleRemove = (valueToRemove: string) => {
    onChange(value.filter((v) => v !== valueToRemove));
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    if (term.length >= minChars && onSearch) {
      onSearch(term);
    }
  };

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm || searchTerm.length < minChars) return options;
    
    const normalized = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(normalized) ||
        opt.value.toLowerCase().includes(normalized)
    );
  }, [options, searchTerm, minChars]);

  const getLabel = (val: string) => {
    const option = options.find((o) => o.value === val);
    return option?.label || val;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate text-muted-foreground">
              {value.length > 0
                ? `${value.length} selecionado(s)`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-50 bg-popover border" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={searchTerm}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(option.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[150px] truncate">{getLabel(v)}</span>
              <button
                type="button"
                onClick={() => handleRemove(v)}
                className="ml-1 hover:text-destructive rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
