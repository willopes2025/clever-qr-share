import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  MessageSquareText,
  Filter
} from "lucide-react";
import { useMessageTemplates, CATEGORY_LABELS, MessageTemplate, CreateTemplateData } from "@/hooks/useMessageTemplates";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateFormDialog } from "@/components/templates/TemplateFormDialog";
import { TemplatePreviewDialog } from "@/components/templates/TemplatePreviewDialog";
import { TemplateVariationsDialog } from "@/components/templates/TemplateVariationsDialog";
import { useTemplateVariationsCounts } from "@/hooks/useTemplateVariations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const MessageModels = () => {
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    toggleActive,
    isCreating,
    isUpdating 
  } = useMessageTemplates();
  
  const templateIds = templates.map(t => t.id);
  const { data: variationCounts } = useTemplateVariationsCounts(templateIds);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isVariationsOpen, setIsVariationsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const handleEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsFormOpen(true);
  };

  const handlePreview = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleVariations = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsVariationsOpen(true);
  };

  const handleFormSubmit = (data: CreateTemplateData) => {
    if (selectedTemplate) {
      updateTemplate({ id: selectedTemplate.id, ...data });
    } else {
      createTemplate(data);
    }
    setIsFormOpen(false);
    setSelectedTemplate(null);
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    setDeleteConfirmId(null);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === "" || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquareText className="h-6 w-6 text-primary" />
              Mensagens Modelo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie mensagens pré-definidas para usar no chat com <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/nome-da-mensagem</code>
            </p>
          </div>
          <Button 
            onClick={() => {
              setSelectedTemplate(null);
              setIsFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>

        {/* Tips Section */}
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">💡 Dicas de uso</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Use variáveis como <code className="bg-muted px-1 rounded">{"{{nome}}"}</code>, <code className="bg-muted px-1 rounded">{"{{telefone}}"}</code>, <code className="bg-muted px-1 rounded">{"{{email}}"}</code> para personalizar mensagens</li>
            <li>• Adicione mídia (imagem, vídeo, áudio ou documento) para mensagens mais completas</li>
            <li>• Gere áudios com IA a partir do texto da mensagem</li>
            <li>• No chat, digite <code className="bg-muted px-1 rounded">/</code> seguido do nome para acessar rapidamente</li>
          </ul>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed border-border">
            <MessageSquareText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium mb-1">Nenhuma mensagem encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || categoryFilter !== "all" 
                ? "Tente ajustar os filtros de busca" 
                : "Crie sua primeira mensagem modelo para usar no chat"
              }
            </p>
            {!searchQuery && categoryFilter === "all" && (
              <Button 
                onClick={() => {
                  setSelectedTemplate(null);
                  setIsFormOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Mensagem
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onPreview={handlePreview}
                onDelete={setDeleteConfirmId}
                onToggleActive={(id, is_active) => toggleActive({ id, is_active })}
                onManageVariations={handleVariations}
                variationsCount={variationCounts?.[template.id] || 0}
              />
            ))}
          </div>
        )}

        {/* Stats */}
        {templates.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-border">
            <Badge variant="secondary" className="text-xs">
              {templates.length} mensagen{templates.length !== 1 ? 's' : ''} modelo
            </Badge>
            <Badge variant="outline" className="text-xs">
              {templates.filter(t => t.is_active).length} ativa{templates.filter(t => t.is_active).length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {templates.filter(t => t.media_url).length} com mídia
            </Badge>
          </div>
        )}

        {/* Dialogs */}
        <TemplateFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          template={selectedTemplate}
          onSubmit={handleFormSubmit}
          isLoading={isCreating || isUpdating}
        />

        <TemplatePreviewDialog
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          template={selectedTemplate}
        />

        <TemplateVariationsDialog
          open={isVariationsOpen}
          onOpenChange={setIsVariationsOpen}
          template={selectedTemplate}
        />

        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir mensagem modelo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default MessageModels;
