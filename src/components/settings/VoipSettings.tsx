import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Server, User, Plus, Trash2, Edit2, RefreshCw } from "lucide-react";
import { useFusionPBXConfig } from "@/hooks/useFusionPBXConfig";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function VoipSettings() {
  const { 
    configs = [], 
    extensions = [], 
    isLoading, 
    createConfig, 
    updateConfig, 
    deleteConfig,
    createExtension,
    updateExtension,
    deleteExtension
  } = useFusionPBXConfig();

  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [editingExtension, setEditingExtension] = useState<any>(null);

  const [configForm, setConfigForm] = useState({
    name: "",
    host: "",
    domain: "",
    esl_port: 8021,
    esl_password: "",
    api_key: "",
    verto_wss_url: ""
  });

  const [extensionForm, setExtensionForm] = useState({
    fusionpbx_config_id: "",
    extension_number: "",
    sip_password: "",
    display_name: "",
    caller_id_name: "",
    caller_id_number: "",
    webrtc_enabled: true,
    voicemail_enabled: false,
    is_active: true,
    organization_id: null as string | null
  });

  const handleSaveConfig = async () => {
    try {
      if (editingConfig) {
        await updateConfig.mutateAsync({ id: editingConfig.id, ...configForm });
      } else {
        await createConfig.mutateAsync(configForm);
      }
      setShowConfigDialog(false);
      resetConfigForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveExtension = async () => {
    try {
      if (editingExtension) {
        await updateExtension.mutateAsync({ id: editingExtension.id, ...extensionForm });
      } else {
        await createExtension.mutateAsync(extensionForm);
      }
      setShowExtensionDialog(false);
      resetExtensionForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta configuração?")) {
      try {
        await deleteConfig.mutateAsync(id);
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  const handleDeleteExtension = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este ramal?")) {
      try {
        await deleteExtension.mutateAsync(id);
      } catch (error) {
        // Error handled by mutation
      }
    }
  };

  const resetConfigForm = () => {
    setConfigForm({
      name: "",
      host: "",
      domain: "",
      esl_port: 8021,
      esl_password: "",
      api_key: "",
      verto_wss_url: ""
    });
    setEditingConfig(null);
  };

  const resetExtensionForm = () => {
    setExtensionForm({
      fusionpbx_config_id: "",
      extension_number: "",
      sip_password: "",
      display_name: "",
      caller_id_name: "",
      caller_id_number: "",
      webrtc_enabled: true,
      voicemail_enabled: false,
      is_active: true,
      organization_id: null
    });
    setEditingExtension(null);
  };

  const openEditConfig = (config: any) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name || "",
      host: config.host,
      domain: config.domain,
      esl_port: config.esl_port || 8021,
      esl_password: config.esl_password || "",
      api_key: config.api_key || "",
      verto_wss_url: config.verto_wss_url || ""
    });
    setShowConfigDialog(true);
  };

  const openEditExtension = (extension: any) => {
    setEditingExtension(extension);
    setExtensionForm({
      fusionpbx_config_id: extension.fusionpbx_config_id,
      extension_number: extension.extension_number,
      sip_password: extension.sip_password,
      display_name: extension.display_name || "",
      caller_id_name: extension.caller_id_name || "",
      caller_id_number: extension.caller_id_number || "",
      webrtc_enabled: extension.webrtc_enabled ?? true,
      voicemail_enabled: extension.voicemail_enabled ?? false,
      is_active: extension.is_active ?? true,
      organization_id: extension.organization_id || null
    });
    setShowExtensionDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Servidores FusionPBX */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Servidores FusionPBX
            </CardTitle>
            <CardDescription>
              Configure os servidores FusionPBX para telefonia VoIP
            </CardDescription>
          </div>
          <Dialog open={showConfigDialog} onOpenChange={(open) => {
            setShowConfigDialog(open);
            if (!open) resetConfigForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Servidor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Editar Servidor" : "Novo Servidor FusionPBX"}
                </DialogTitle>
                <DialogDescription>
                  Configure as credenciais do servidor FusionPBX
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    placeholder="Servidor Principal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Host</Label>
                    <Input
                      value={configForm.host}
                      onChange={(e) => setConfigForm({ ...configForm, host: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <Label>Domínio</Label>
                    <Input
                      value={configForm.domain}
                      onChange={(e) => setConfigForm({ ...configForm, domain: e.target.value })}
                      placeholder="pbx.empresa.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Porta ESL</Label>
                    <Input
                      type="number"
                      value={configForm.esl_port}
                      onChange={(e) => setConfigForm({ ...configForm, esl_port: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Senha ESL</Label>
                    <Input
                      type="password"
                      value={configForm.esl_password}
                      onChange={(e) => setConfigForm({ ...configForm, esl_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={configForm.api_key}
                    onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })}
                    placeholder="Chave de API do FusionPBX"
                  />
                </div>

                <div>
                  <Label>URL WebSocket (Verto)</Label>
                  <Input
                    value={configForm.verto_wss_url}
                    onChange={(e) => setConfigForm({ ...configForm, verto_wss_url: e.target.value })}
                    placeholder="wss://pbx.empresa.com:8082"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig} disabled={createConfig.isPending || updateConfig.isPending}>
                  {editingConfig ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum servidor configurado. Adicione um servidor FusionPBX para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{config.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {config.host} • {config.domain}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.is_active ? "default" : "secondary"}>
                      {config.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditConfig(config)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteConfig(config.id)}
                      disabled={deleteConfig.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Ramais */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Ramais
            </CardTitle>
            <CardDescription>
              Configure os ramais para cada usuário
            </CardDescription>
          </div>
          <Dialog open={showExtensionDialog} onOpenChange={(open) => {
            setShowExtensionDialog(open);
            if (!open) resetExtensionForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={configs.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ramal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingExtension ? "Editar Ramal" : "Novo Ramal"}
                </DialogTitle>
                <DialogDescription>
                  Configure as informações do ramal SIP
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>Servidor</Label>
                  <select
                    className="w-full p-2 border rounded-md bg-background"
                    value={extensionForm.fusionpbx_config_id}
                    onChange={(e) => setExtensionForm({ ...extensionForm, fusionpbx_config_id: e.target.value })}
                  >
                    <option value="">Selecione um servidor</option>
                    {configs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Número do Ramal</Label>
                    <Input
                      value={extensionForm.extension_number}
                      onChange={(e) => setExtensionForm({ ...extensionForm, extension_number: e.target.value })}
                      placeholder="1001"
                    />
                  </div>
                  <div>
                    <Label>Senha SIP</Label>
                    <Input
                      type="password"
                      value={extensionForm.sip_password}
                      onChange={(e) => setExtensionForm({ ...extensionForm, sip_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <Label>Nome de Exibição</Label>
                  <Input
                    value={extensionForm.display_name}
                    onChange={(e) => setExtensionForm({ ...extensionForm, display_name: e.target.value })}
                    placeholder="João Silva"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Caller ID Nome</Label>
                    <Input
                      value={extensionForm.caller_id_name}
                      onChange={(e) => setExtensionForm({ ...extensionForm, caller_id_name: e.target.value })}
                      placeholder="Empresa"
                    />
                  </div>
                  <div>
                    <Label>Caller ID Número</Label>
                    <Input
                      value={extensionForm.caller_id_number}
                      onChange={(e) => setExtensionForm({ ...extensionForm, caller_id_number: e.target.value })}
                      placeholder="1140001234"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={extensionForm.webrtc_enabled}
                      onCheckedChange={(checked) => setExtensionForm({ ...extensionForm, webrtc_enabled: checked })}
                    />
                    <Label>WebRTC habilitado</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={extensionForm.voicemail_enabled}
                      onCheckedChange={(checked) => setExtensionForm({ ...extensionForm, voicemail_enabled: checked })}
                    />
                    <Label>Voicemail</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowExtensionDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveExtension} disabled={createExtension.isPending || updateExtension.isPending}>
                  {editingExtension ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {extensions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {configs.length === 0
                ? "Configure um servidor primeiro para adicionar ramais."
                : "Nenhum ramal configurado. Adicione um ramal para usar o softphone."}
            </p>
          ) : (
            <div className="space-y-3">
              {extensions.map((extension) => (
                <div
                  key={extension.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {extension.display_name || `Ramal ${extension.extension_number}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ramal: {extension.extension_number}
                        {extension.caller_id_number && ` • ${extension.caller_id_number}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {extension.webrtc_enabled && (
                      <Badge variant="outline">WebRTC</Badge>
                    )}
                    <Badge variant={extension.is_active ? "default" : "secondary"}>
                      {extension.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditExtension(extension)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExtension(extension.id)}
                      disabled={deleteExtension.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
