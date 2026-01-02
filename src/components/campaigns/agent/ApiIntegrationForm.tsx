import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, Zap } from "lucide-react";
import { AgentIntegration, useAgentIntegrations } from "@/hooks/useAgentIntegrations";

interface ApiIntegrationFormProps {
  agentConfigId: string;
  integration: AgentIntegration | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const ApiIntegrationForm = ({ agentConfigId, integration, onClose, onSave }: ApiIntegrationFormProps) => {
  const { testApiConnection } = useAgentIntegrations(agentConfigId);
  
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(integration?.name || "");
  const [description, setDescription] = useState(integration?.description || "");
  const [apiBaseUrl, setApiBaseUrl] = useState(integration?.api_base_url || "");
  const [authType, setAuthType] = useState<string>(integration?.api_auth_type || "none");
  const [credentials, setCredentials] = useState<Record<string, string>>(integration?.api_credentials || {});
  const [headers, setHeaders] = useState(
    integration?.api_headers 
      ? Object.entries(integration.api_headers).map(([key, value]) => `${key}: ${value}`).join("\n")
      : ""
  );

  const handleSave = async () => {
    if (!name.trim() || !apiBaseUrl.trim()) return;

    setIsSaving(true);
    try {
      const headersObj: Record<string, string> = {};
      headers.split("\n").forEach((line) => {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length) {
          headersObj[key.trim()] = valueParts.join(":").trim();
        }
      });

      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        api_base_url: apiBaseUrl.trim(),
        api_auth_type: authType,
        api_credentials: credentials,
        api_headers: headersObj,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    const headersObj: Record<string, string> = {};
    headers.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length) {
        headersObj[key.trim()] = valueParts.join(":").trim();
      }
    });

    await testApiConnection.mutateAsync({
      id: integration?.id || "",
      api_base_url: apiBaseUrl,
      api_auth_type: authType as any,
      api_credentials: credentials,
      api_headers: headersObj,
    } as AgentIntegration);
  };

  const renderCredentialsFields = () => {
    switch (authType) {
      case "bearer":
        return (
          <div>
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Seu token de acesso"
              value={credentials.token || ""}
              onChange={(e) => setCredentials({ ...credentials, token: e.target.value })}
              className="mt-1"
            />
          </div>
        );
      case "api_key":
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Sua API Key"
                value={credentials.api_key || ""}
                onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="header_name">Nome do Header</Label>
              <Input
                id="header_name"
                placeholder="X-API-Key"
                value={credentials.header_name || "X-API-Key"}
                onChange={(e) => setCredentials({ ...credentials, header_name: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">O header onde a API Key será enviada</p>
            </div>
          </div>
        );
      case "basic":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                placeholder="username"
                value={credentials.username || ""}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="password"
                value={credentials.password || ""}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        );
      case "oauth2":
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                placeholder="Client ID"
                value={credentials.client_id || ""}
                onChange={(e) => setCredentials({ ...credentials, client_id: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="client_secret">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                placeholder="Client Secret"
                value={credentials.client_secret || ""}
                onChange={(e) => setCredentials({ ...credentials, client_secret: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="access_token">Access Token (opcional)</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Token de acesso já obtido"
                value={credentials.access_token || ""}
                onChange={(e) => setCredentials({ ...credentials, access_token: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {integration ? "Editar Integração API" : "Nova Integração API"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nome da Integração *</Label>
            <Input
              id="name"
              placeholder="Ex: CRM HubSpot, API de Leads..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="authType">Tipo de Autenticação</Label>
            <Select value={authType} onValueChange={setAuthType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            placeholder="Breve descrição do que esta integração faz"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="apiBaseUrl">URL Base da API *</Label>
          <Input
            id="apiBaseUrl"
            placeholder="https://api.exemplo.com/v1"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            className="mt-1"
          />
        </div>

        {authType !== "none" && (
          <div className="pt-2 border-t">
            <h4 className="font-medium mb-3">Credenciais</h4>
            {renderCredentialsFields()}
          </div>
        )}

        <div>
          <Label htmlFor="headers">Headers Customizados</Label>
          <Textarea
            id="headers"
            placeholder="Content-Type: application/json&#10;X-Custom-Header: valor"
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="mt-1 font-mono text-sm"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">Um header por linha no formato "Nome: Valor"</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!apiBaseUrl.trim() || testApiConnection.isPending}
          >
            {testApiConnection.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            Testar Conexão
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !apiBaseUrl.trim() || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
