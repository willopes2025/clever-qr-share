import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
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
import { useTemplateVariationsCounts } from '@/hooks/useTemplateVariations';
import { TemplateFormDialog } from '@/components/templates/TemplateFormDialog';
import { TemplatePreviewDialog } from '@/components/templates/TemplatePreviewDialog';
import { TemplateVariationsDialog } from '@/components/templates/TemplateVariationsDialog';
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

  // Get variation counts for all templates
  const templateIds = templates.map(t => t.id);
  const { data: variationsCounts } = useTemplateVariationsCounts(templateIds);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isVariationsOpen, setIsVariationsOpen] = useState(false);
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

  const handleManageVariations = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsVariationsOpen(true);
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
    <DashboardLayout className="p-8 space-y-6 cyber-grid">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-glow-cyan">Templates de Mensagem</h1>
          <p className="text-muted-foreground">
            Crie e gerencie templates com variáveis dinâmicas
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(null); setIsFormOpen(true); }} className="bg-gradient-neon hover:opacity-90">
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
            className="pl-9 bg-dark-800/50 border-neon-cyan/30 focus:border-neon-cyan"
          />
        </div>

        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TemplateCategory | 'all')}>
          <SelectTrigger className="w-[180px] bg-dark-800/50 border-neon-cyan/30">
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
            <div key={i} className="h-64 bg-dark-800/50 border border-neon-cyan/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-neon mb-4 pulse-neon">
            <FileText className="h-8 w-8 text-dark-900" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery || categoryFilter !== 'all' ? 'Nenhum template encontrado' : 'Nenhum template criado'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || categoryFilter !== 'all' 
              ? 'Tente ajustar os filtros de busca'
              : 'Crie seu primeiro template de mensagem'}
          </p>
          {!searchQuery && categoryFilter === 'all' && (
            <Button onClick={() => { setSelectedTemplate(null); setIsFormOpen(true); }} className="bg-gradient-neon">
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
              variationsCount={variationsCounts?.[template.id] || 0}
              onEdit={handleEdit}
              onDelete={setDeleteId}
              onPreview={handlePreview}
              onToggleActive={(id, is_active) => toggleActive({ id, is_active })}
              onManageVariations={handleManageVariations}
            />
          ))}
        </div>
      )}

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

      {/* Variations Dialog */}
      <TemplateVariationsDialog
        open={isVariationsOpen}
        onOpenChange={setIsVariationsOpen}
        template={selectedTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="glass-card border-neon-magenta/30">
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
    </DashboardLayout>
  );
};

export default Templates;