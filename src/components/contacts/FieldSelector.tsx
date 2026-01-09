import { CustomFieldDefinition } from "@/hooks/useCustomFields";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";

interface FieldSelectorProps {
  availableFields: CustomFieldDefinition[];
  addedFieldIds: string[];
  onSelectField: (fieldId: string) => void;
  onCreateNew: () => void;
  children?: React.ReactNode;
}

export const FieldSelector = ({
  availableFields,
  addedFieldIds,
  onSelectField,
  onCreateNew,
  children,
}: FieldSelectorProps) => {
  const notAddedFields = availableFields.filter(
    (field) => !addedFieldIds.includes(field.id)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button type="button" variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar campo
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {notAddedFields.length > 0 ? (
          <>
            {notAddedFields.map((field) => (
              <DropdownMenuItem
                key={field.id}
                onClick={() => onSelectField(field.id)}
              >
                {field.field_name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Todos os campos já foram adicionados
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onCreateNew} className="text-primary">
          <Plus className="h-4 w-4 mr-2" />
          Criar novo campo...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
