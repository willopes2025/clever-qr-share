import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Smartphone } from "lucide-react";
import { useMetaWhatsAppNumbers } from "@/hooks/useMetaWhatsAppNumbers";
import { WhatsAppNumberCard } from "./WhatsAppNumberCard";
import { toast } from "sonner";

export const WhatsAppNumbersList = () => {
  const { metaNumbers, isLoading, updateNumber, deleteNumber } = useMetaWhatsAppNumbers();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setUpdatingId(id);
    try {
      await updateNumber.mutateAsync({ id, isActive });
      toast.success(isActive ? "Número ativado" : "Número desativado");
    } catch {
      toast.error("Erro ao atualizar número");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteNumber.mutateAsync(id);
    } catch {
      toast.error("Erro ao remover número");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metaNumbers || metaNumbers.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Números Conectados</CardTitle>
            <CardDescription>
              {metaNumbers.length} número{metaNumbers.length !== 1 ? "s" : ""} registrado{metaNumbers.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metaNumbers.map((number) => (
          <WhatsAppNumberCard
            key={number.id}
            number={number}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
            isUpdating={updatingId === number.id}
            isDeleting={deletingId === number.id}
          />
        ))}
      </CardContent>
    </Card>
  );
};
