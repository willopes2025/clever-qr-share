import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddKPIButtonProps {
  onClick: () => void;
}

export const AddKPIButton = ({ onClick }: AddKPIButtonProps) => {
  return (
    <Button 
      onClick={onClick}
      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
    >
      <Plus className="h-4 w-4" />
      Adicionar KPIs
    </Button>
  );
};
