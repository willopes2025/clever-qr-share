import { useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  useMessageTemplates, 
  MessageTemplate, 
  CreateTemplateData,
  TemplateCategory,
  CATEGORY_LABELS 
} from '@/hooks/useMessageTemplates';
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog';
import { TemplatePreviewDialog } from '@/components/templates/TemplatePreviewDialog';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { Plus, Search, FileText, Filter } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Templates = () => {
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');

  const handleEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsFormOpen(true);
  };

  const handlePreview = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSubmit = (data: CreateTemplateData) => {
    if (selectedTemplate) {
      updateTemplate({ id: selectedTemplate.id, ...data });
    } else {
      createTemplate(data);
    }
    setSelectedTemplate(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTemplate(deleteId);
      setDeleteId(null);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Templates de Mensagem</h1>
                <p className="text-muted-foreground">
                  Crie e gerencie templates com variáveis dinâmicas
                </p>
              </div>
              <Button onClick={() => { setSelectedTemplate(null); setIsFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>

              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TemplateCategory | 'all')}>
                <SelectTrigger className="w-[180px] bg-card border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Templates Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-card border border-border rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchQuery || categoryFilter !== 'all' ? 'Nenhum template encontrado' : 'Nenhum template criado'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || categoryFilter !== 'all' 
                    ? 'Tente ajustar os filtros de busca'
                    : 'Crie seu primeiro template de mensagem'}
                </p>
                {!searchQuery && categoryFilter === 'all' && (
                  <Button onClick={() => { setSelectedTemplate(null); setIsFormOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Template
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
                    onDelete={setDeleteId}
                    onPreview={handlePreview}
                    onToggleActive={(id, is_active) => toggleActive({ id, is_active })}
                  />
                ))}
              </div>
            )}
      </main>

      {/* Form Dialog */}
      <TemplateFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        template={selectedTemplate}
        onSubmit={handleSubmit}
        isLoading={isCreating || isUpdating}
      />

      {/* Preview Dialog */}
      <TemplatePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        template={selectedTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Templates;
