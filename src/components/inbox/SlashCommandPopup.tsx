import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Zap, FileText, Image, Video, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageTemplate, CATEGORY_LABELS, CATEGORY_COLORS } from "@/hooks/useMessageTemplates";
import { motion, AnimatePresence } from "framer-motion";

interface SlashCommandPopupProps {
  isOpen: boolean;
  templates: MessageTemplate[];
  searchTerm: string;
  selectedIndex: number;
  onSelect: (template: MessageTemplate) => void;
  onClose: () => void;
  contactName?: string;
}

export const SlashCommandPopup = ({
  isOpen,
  templates,
  searchTerm,
  selectedIndex,
  onSelect,
  onClose,
  contactName,
}: SlashCommandPopupProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Filter templates based on search term
  const filteredTemplates = templates.filter(template => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      template.name.toLowerCase().includes(search) ||
      template.content.toLowerCase().includes(search) ||
      CATEGORY_LABELS[template.category].toLowerCase().includes(search)
    );
  }).slice(0, 8); // Limit to 8 results

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Preview content with variable substitution
  const previewContent = (content: string) => {
    let preview = content
      .replace(/\{\{nome\}\}/gi, contactName || "[nome]")
      .replace(/\{\{name\}\}/gi, contactName || "[name]")
      .replace(/\{\{telefone\}\}/gi, "[telefone]")
      .replace(/\{\{phone\}\}/gi, "[phone]")
      .replace(/\{\{email\}\}/gi, "[email]");
    
    // Truncate if too long
    if (preview.length > 80) {
      preview = preview.substring(0, 80) + "...";
    }
    return preview;
  };
  // Get media icon based on type
  const getMediaIcon = (type: string | undefined) => {
    switch (type) {
      case 'image': return <Image className="h-3 w-3" />;
      case 'video': return <Video className="h-3 w-3" />;
      case 'audio': return <Mic className="h-3 w-3" />;
      case 'document': return <FileText className="h-3 w-3" />;
      default: return null;
    }
  };

  const getMediaLabel = (type: string | undefined) => {
    switch (type) {
      case 'image': return '📷';
      case 'video': return '📹';
      case 'audio': return '🎵';
      case 'document': return '📄';
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-2 md:mx-4 z-50"
        >
          <div className="bg-card border border-border rounded-lg shadow-xl overflow-hidden backdrop-blur-sm">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                <span>Respostas rápidas</span>
                {searchTerm && (
                  <span className="text-xs">
                    • Buscando "{searchTerm}"
                  </span>
                )}
              </div>
            </div>

            {/* Template list */}
            <ScrollArea className="max-h-[300px]" ref={listRef}>
              {filteredTemplates.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm 
                      ? `Nenhum template encontrado para "${searchTerm}"` 
                      : "Nenhum template disponível"
                    }
                  </p>
                  <p className="text-xs mt-1">
                    Crie templates em Configurações → Templates
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredTemplates.map((template, index) => (
                    <button
                      key={template.id}
                      ref={index === selectedIndex ? selectedRef : null}
                      onClick={() => onSelect(template)}
                      className={cn(
                        "w-full px-3 py-2 text-left transition-colors",
                        "hover:bg-accent/50 focus:outline-none",
                        index === selectedIndex && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          /{template.name.toLowerCase().replace(/\s+/g, '-')}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[template.category])}
                        >
                          {CATEGORY_LABELS[template.category]}
                        </Badge>
                        {template.media_url && template.media_type && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                            {getMediaLabel(template.media_type)}
                            {template.media_type === 'image' ? 'img' : 
                             template.media_type === 'video' ? 'vid' : 
                             template.media_type === 'audio' ? 'áudio' : 'doc'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {previewContent(template.content)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer with keyboard hints */}
            {filteredTemplates.length > 0 && (
              <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground flex gap-3">
                <span>↑↓ navegar</span>
                <span>Enter selecionar</span>
                <span>Esc fechar</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
