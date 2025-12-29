import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomFields } from '@/hooks/useCustomFields';
import { User, FileText, AtSign, Phone, Mail, Loader2 } from 'lucide-react';

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

interface VariableOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const DEFAULT_VARIABLES: VariableOption[] = [
  { key: 'nome', label: 'Nome do contato', icon: <User className="h-3.5 w-3.5" />, group: 'Dados do Contato' },
  { key: 'telefone', label: 'Telefone', icon: <Phone className="h-3.5 w-3.5" />, group: 'Dados do Contato' },
  { key: 'email', label: 'Email', icon: <Mail className="h-3.5 w-3.5" />, group: 'Dados do Contato' },
];

export const VariableAutocomplete = ({
  value,
  onChange,
  placeholder,
  rows = 6,
  className
}: VariableAutocompleteProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const { fieldDefinitions, isLoading } = useCustomFields();

  // Build all available variables with useMemo for proper reactivity
  const allVariables = useMemo<VariableOption[]>(() => [
    ...DEFAULT_VARIABLES,
    ...(fieldDefinitions || []).map(field => ({
      key: field.field_key,
      label: field.field_name,
      icon: <FileText className="h-3.5 w-3.5" />,
      group: 'Campos Personalizados'
    }))
  ], [fieldDefinitions]);

  // Filter variables based on search term
  const filteredVariables = allVariables.filter(v => 
    v.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group variables
  const groupedVariables = filteredVariables.reduce((acc, variable) => {
    if (!acc[variable.group]) {
      acc[variable.group] = [];
    }
    acc[variable.group].push(variable);
    return acc;
  }, {} as Record<string, VariableOption[]>);

  const flatFilteredList = filteredVariables;

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, pos);
    
    // Check if we just typed {{ 
    const lastTwoChars = textBeforeCursor.slice(-2);
    
    if (lastTwoChars === '{{') {
      setIsOpen(true);
      setSearchTerm('');
      setCursorPosition(pos);
      setSelectedIndex(0);
    } else if (isOpen) {
      // Check if we're still inside a {{ ... pattern
      const lastOpenBracket = textBeforeCursor.lastIndexOf('{{');
      const lastCloseBracket = textBeforeCursor.lastIndexOf('}}');
      
      if (lastOpenBracket > lastCloseBracket) {
        // We're inside an open variable
        const searchText = textBeforeCursor.substring(lastOpenBracket + 2);
        setSearchTerm(searchText);
        setCursorPosition(pos);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
      }
    }
  }, [value, isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatFilteredList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatFilteredList.length > 0) {
      e.preventDefault();
      selectVariable(flatFilteredList[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, flatFilteredList, selectedIndex]);

  const selectVariable = (variable: VariableOption) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Find the {{ that triggered this
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastOpenBracket = textBeforeCursor.lastIndexOf('{{');
    
    // Replace from {{ to cursor with {{variable}}
    const newValue = 
      value.substring(0, lastOpenBracket) + 
      `{{${variable.key}}}` + 
      value.substring(cursorPosition);
    
    onChange(newValue);
    setIsOpen(false);
    
    // Focus back and set cursor after the inserted variable
    setTimeout(() => {
      if (textarea) {
        const newPos = lastOpenBracket + variable.key.length + 4; // {{}} = 4 chars
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        // Check if click was inside popover
        const popover = document.querySelector('[data-radix-popper-content-wrapper]');
        if (popover && popover.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={className}
        />
      </PopoverAnchor>
      <PopoverContent 
        className="w-72 p-0 bg-card border-border" 
        align="start"
        side="bottom"
        sideOffset={5}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AtSign className="h-3 w-3" />
            Selecione uma variável
          </p>
        </div>
        <ScrollArea className="h-[200px]">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando campos...
            </div>
          ) : Object.keys(groupedVariables).length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Nenhuma variável encontrada
            </div>
          ) : (
            Object.entries(groupedVariables).map(([group, variables]) => (
              <div key={group}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">
                  {group}
                </div>
                {variables.map((variable, idx) => {
                  const globalIndex = flatFilteredList.findIndex(v => v.key === variable.key);
                  return (
                    <button
                      key={variable.key}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${
                        globalIndex === selectedIndex ? 'bg-accent' : ''
                      }`}
                      onClick={() => selectVariable(variable)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className="text-muted-foreground">{variable.icon}</span>
                      <span className="flex-1">
                        <span className="text-foreground font-mono text-xs">{`{{${variable.key}}}`}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{variable.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
