import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useContacts } from "@/hooks/useContacts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Download, Trash2, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const DataSettings = () => {
  const { contacts } = useContacts();
  const { data: campaigns } = useCampaigns();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportContacts = async () => {
    if (!contacts || contacts.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }

    setExporting('contacts');
    try {
      const headers = ['telefone', 'nome', 'email', 'notas', 'status', 'criado_em'];
      const rows = contacts.map(c => [
        c.phone,
        c.name || '',
        c.email || '',
        c.notes || '',
        c.status,
        c.created_at
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`${contacts.length} contatos exportados com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar contatos");
    } finally {
      setExporting(null);
    }
  };

  const exportCampaigns = async () => {
    if (!campaigns || campaigns.length === 0) {
      toast.error("Nenhuma campanha para exportar");
      return;
    }

    setExporting('campaigns');
    try {
      const headers = ['nome', 'status', 'total_contatos', 'enviados', 'entregues', 'falhas', 'criado_em'];
      const rows = campaigns.map(c => [
        c.name,
        c.status,
        c.total_contacts,
        c.sent,
        c.delivered,
        c.failed,
        c.created_at
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `campanhas_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`${campaigns.length} campanhas exportadas com sucesso!`);
    } catch (error) {
      toast.error("Erro ao exportar campanhas");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Dados
          </CardTitle>
          <CardDescription>
            Faça backup dos seus dados em formato CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Exportar Contatos</p>
              <p className="text-sm text-muted-foreground">
                {contacts?.length || 0} contatos disponíveis
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={exportContacts}
              disabled={exporting === 'contacts'}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'contacts' ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Exportar Campanhas</p>
              <p className="text-sm text-muted-foreground">
                {campaigns?.length || 0} campanhas disponíveis
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={exportCampaigns}
              disabled={exporting === 'campaigns'}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'campaigns' ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Armazenamento
          </CardTitle>
          <CardDescription>
            Informações sobre uso de armazenamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{contacts?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Contatos</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{campaigns?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Campanhas</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">
                {campaigns?.reduce((acc, c) => acc + c.sent, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zona de Perigo
          </CardTitle>
          <CardDescription>
            Ações irreversíveis que afetam seus dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Histórico de Campanhas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todo o histórico de campanhas concluídas.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => toast.info("Funcionalidade em desenvolvimento")}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Minha Conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá excluir permanentemente sua conta e todos os dados associados,
                  incluindo contatos, campanhas, templates e histórico de mensagens.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => toast.info("Funcionalidade em desenvolvimento")}
                >
                  Excluir Conta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};
