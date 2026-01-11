import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Plus, Settings, Trash2, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { useMetaWhatsAppNumbers, MetaWhatsAppNumber } from "@/hooks/useMetaWhatsAppNumbers";
import { MetaWebhookConfigDialog } from "./MetaWebhookConfigDialog";
import { AddMetaNumberDialog } from "./AddMetaNumberDialog";
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

interface MetaWhatsAppSectionProps {
  webhookConfigured?: boolean;
}

export const MetaWhatsAppSection = ({ webhookConfigured = false }: MetaWhatsAppSectionProps) => {
  const { metaNumbers, isLoading, deleteNumber } = useMetaWhatsAppNumbers();
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [numberToDelete, setNumberToDelete] = useState<MetaWhatsAppNumber | null>(null);

  const handleDeleteClick = (number: MetaWhatsAppNumber) => {
    setNumberToDelete(number);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (numberToDelete) {
      await deleteNumber.mutateAsync(numberToDelete.id);
      setDeleteConfirmOpen(false);
      setNumberToDelete(null);
    }
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return "Não definido";
    // Remove non-digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold">WhatsApp API (Meta)</h2>
          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
            Business API
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWebhookDialogOpen(true)}
            className="gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Configurar Webhook
          </Button>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-1.5 bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" />
            Adicionar Número
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse bg-muted/50">
              <CardContent className="p-6">
                <div className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metaNumbers && metaNumbers.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metaNumbers.map((number) => (
            <Card key={number.id} className="glass-card border-blue-500/30 hover:border-blue-500/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {number.display_name || "Meta WhatsApp"}
                  </CardTitle>
                  <Badge 
                    variant={webhookConfigured ? "default" : "secondary"}
                    className={webhookConfigured 
                      ? "bg-green-500/90 text-white" 
                      : "bg-yellow-500/90 text-white"
                    }
                  >
                    {webhookConfigured ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ativo
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Configurar
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-mono text-sm">{formatPhoneNumber(number.phone_number)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone Number ID</p>
                  <p className="font-mono text-xs text-muted-foreground">{number.phone_number_id}</p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWebhookDialogOpen(true)}
                    className="text-xs gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver instruções
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(number)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border-dashed border-2 border-muted-foreground/30">
          <CardContent className="py-8 text-center">
            <Cloud className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum número Meta WhatsApp API configurado.
            </p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Número
            </Button>
          </CardContent>
        </Card>
      )}

      <MetaWebhookConfigDialog
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
      />

      <AddMetaNumberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover número Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover o número {formatPhoneNumber(numberToDelete?.phone_number)} do sistema.
              As conversas existentes serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
