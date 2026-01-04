import { Form } from "@/hooks/useForms";
import { FormCard } from "./FormCard";
import { FileEdit } from "lucide-react";

interface FormsListProps {
  forms: Form[];
}

export const FormsList = ({ forms }: FormsListProps) => {
  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileEdit className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nenhum formulário encontrado</h3>
        <p className="text-muted-foreground max-w-sm">
          Crie seu primeiro formulário para começar a capturar leads e dados de clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {forms.map((form) => (
        <FormCard key={form.id} form={form} />
      ))}
    </div>
  );
};
