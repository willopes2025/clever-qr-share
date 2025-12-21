import { useState } from "react";
import { Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMessageTemplates, CATEGORY_LABELS, CATEGORY_COLORS } from "@/hooks/useMessageTemplates";

interface QuickReplyButtonProps {
  onSelect: (content: string) => void;
  contactName?: string;
}

export const QuickReplyButton = ({ onSelect, contactName }: QuickReplyButtonProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { templates, isLoading } = useMessageTemplates();

  const activeTemplates = templates?.filter(t => t.is_active) || [];
  
  const filteredTemplates = activeTemplates.filter(template =>
    template.name.toLowerCase().includes(search.toLowerCase()) ||
    template.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (content: string) => {
    // Replace variables with contact data
    let processedContent = content;
    if (contactName) {
      processedContent = processedContent.replace(/\{\{nome\}\}/gi, contactName);
      processedContent = processedContent.replace(/\{\{name\}\}/gi, contactName);
    }
    
    onSelect(processedContent);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Respostas rápidas"
        >
          <Zap className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        side="top"
      >
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {search ? "Nenhum template encontrado" : "Nenhum template ativo"}
            </div>
          ) : (
            <div className="p-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template.content)}
                  className="w-full p-3 text-left hover:bg-accent rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{template.name}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${CATEGORY_COLORS[template.category]}`}
                    >
                      {CATEGORY_LABELS[template.category]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
