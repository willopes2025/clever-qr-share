import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Trash2, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { useElevenLabsSIP } from "@/hooks/useElevenLabsSIP";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ElevenLabsSIPSettings = () => {
  const { sipConfigs, isLoadingSIP, createSIPConfig, deleteSIPConfig, isSIPConfigured } = useElevenLabsSIP();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone_number_id: '',
    phone_number: '',
    label: 'Vono Principal',
    sip_username: '',
    sip_domain: 'vono2.me',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createSIPConfig.mutateAsync({
      phone_number_id: formData.phone_number_id,
      phone_number: formData.phone_number,
      label: formData.label,
      sip_username: formData.sip_username || undefined,
      sip_domain: formData.sip_domain || undefined,
    });

    setIsDialogOpen(false);
    setFormData({
      phone_number_id: '',
      phone_number: '',
      label: 'Vono Principal',
      sip_username: '',
      sip_domain: 'vono2.me',
    });
  };

  const handleDelete = async (configId: string) => {
    if (confirm('Tem certeza que deseja remover esta configuração?')) {
      await deleteSIPConfig.mutateAsync(configId);
    }
  };

  if (isLoadingSIP) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Chamadas com IA via SIP Trunk
          </CardTitle>
          <CardDescription>
            Configure a integração do ElevenLabs com seu número Vono para fazer chamadas reais atendidas por IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium">Como configurar:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Acesse o{" "}
                <a 
                  href="https://elevenlabs.io/app/agents/phone-numbers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  Dashboard do ElevenLabs <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Clique em "Import a phone number from SIP trunk"</li>
              <li>
                Preencha com os dados do Vono:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Phone Number: seu número Vono</li>
                  <li>Outbound Address: vono2.me</li>
                  <li>Transport Type: TCP</li>
                  <li>SIP Username/Password: suas credenciais Vono</li>
                </ul>
              </li>
              <li>Copie o "Phone Number ID" gerado e cole abaixo</li>
            </ol>
          </div>

          {/* Existing configs */}
          {sipConfigs && sipConfigs.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Números configurados:</h4>
              {sipConfigs.map((config) => (
                <div 
                  key={config.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.phone_number}</p>
                    </div>
                    {config.is_active && (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              Nenhum número SIP configurado ainda.
            </div>
          )}

          {/* Add new config */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Número SIP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Configurar Número SIP</DialogTitle>
                  <DialogDescription>
                    Adicione as informações do número SIP configurado no ElevenLabs.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone_number_id">Phone Number ID (ElevenLabs) *</Label>
                    <Input
                      id="phone_number_id"
                      placeholder="Ex: pn_abc123..."
                      value={formData.phone_number_id}
                      onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Encontre este ID no dashboard do ElevenLabs após importar o número.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Número de Telefone *</Label>
                    <Input
                      id="phone_number"
                      placeholder="Ex: +552720181290"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="label">Nome/Label</Label>
                    <Input
                      id="label"
                      placeholder="Ex: Vono Principal"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sip_username">Usuário SIP</Label>
                      <Input
                        id="sip_username"
                        placeholder="Ex: W_Alberto"
                        value={formData.sip_username}
                        onChange={(e) => setFormData({ ...formData, sip_username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sip_domain">Domínio SIP</Label>
                      <Input
                        id="sip_domain"
                        placeholder="vono2.me"
                        value={formData.sip_domain}
                        onChange={(e) => setFormData({ ...formData, sip_domain: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createSIPConfig.isPending}>
                    {createSIPConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};
