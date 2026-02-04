import { useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileEdit, Loader2 } from "lucide-react";
import { useForms } from "@/hooks/useForms";
import { FormsList } from "@/components/forms/FormsList";
import { CreateFormDialog } from "@/components/forms/CreateFormDialog";

const Forms = () => {
  const { forms, isLoading } = useForms();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredForms = forms?.filter(form =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout pageTitle="Formulários">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileEdit className="h-6 w-6 text-primary" />
              Formulários
            </h1>
            <p className="text-muted-foreground mt-1">
              Crie formulários personalizados para capturar leads e dados
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Formulário
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar formulários..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <FormsList forms={filteredForms || []} />
        )}

        {/* Create Dialog */}
        <CreateFormDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog} 
        />
      </div>
    </AppLayout>
  );
};

export default Forms;
