import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, X, Zap } from "lucide-react";
import { AgentIntegration, useAgentIntegrations } from "@/hooks/useAgentIntegrations";

interface WebhookOutFormProps {
  agentConfigId: string;
  integration: AgentIntegration | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const WEBHOOK_EVENTS = [
  { id: "booking_created", label: "Agendamento criado", description: "Quando um agendamento é confirmado" },
  { id: "booking_canceled", label: "Agendamento cancelado", description: "Quando um agendamento é cancelado" },
  { id: "message_received", label: "Mensagem recebida", description: "Quando o agente recebe uma mensagem" },
  { id: "conversation_started", label: "Conversa iniciada", description: "Quando uma nova conversa começa" },
  { id: "conversation_ended", label: "Conversa finalizada", description: "Quando a conversa é encerrada" },
  { id: "handoff_requested", label: "Transferência solicitada", description: "Quando o cliente pede atendimento humano" },
  { id: "lead_qualified", label: "Lead qualificado", description: "Quando o lead é marcado como qualificado" },
  { id: "data_collected", label: "Dados coletados", description: "Quando dados importantes são coletados" },
];

const DEFAULT_PAYLOAD_TEMPLATE = {
  event: "{{event}}",
  timestamp: "{{timestamp}}",
  agent_id: "{{agent_id}}",
  contact: {
    name: "{{contact_name}}",
    phone: "{{contact_phone}}",
  },
  data: "{{event_data}}",
};

export const WebhookOutForm = ({ agentConfigId, integration, onClose, onSave }: WebhookOutFormProps) => {
  const { testWebhookOut } = useAgentIntegrations(agentConfigId);
  
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(integration?.name || "");
  const [targetUrl, setTargetUrl] = useState(integration?.webhook_target_url || "");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(integration?.webhook_events || []);
  const [payloadTemplate, setPayloadTemplate] = useState(
    integration?.webhook_payload_template 
      ? JSON.stringify(integration.webhook_payload_template, null, 2)
      : JSON.stringify(DEFAULT_PAYLOAD_TEMPLATE, null, 2)
  );

  const handleEventToggle = (eventId: string, checked: boolean) => {
    if (checked) {
      setSelectedEvents([...selectedEvents, eventId]);
    } else {
      setSelectedEvents(selectedEvents.filter((e) => e !== eventId));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !targetUrl.trim()) return;

    setIsSaving(true);
    try {
      let parsedTemplate = null;
      try {
        parsedTemplate = JSON.parse(payloadTemplate);
      } catch (e) {
        // Invalid JSON, will save as null
      }

      await onSave({
        name: name.trim(),
        webhook_target_url: targetUrl.trim(),
        webhook_events: selectedEvents,
        webhook_payload_template: parsedTemplate,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!integration) return;

    let parsedTemplate = null;
    try {
      parsedTemplate = JSON.parse(payloadTemplate);
    } catch (e) {
      // Use default
    }

    await testWebhookOut.mutateAsync({
      ...integration,
      webhook_target_url: targetUrl,
      webhook_payload_template: parsedTemplate,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {integration ? "Editar Webhook de Saída" : "Novo Webhook de Saída"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Nome do Webhook *</Label>
          <Input
            id="name"
            placeholder="Ex: Notificar CRM, Enviar para Zapier..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="targetUrl">URL de Destino *</Label>
          <Input
            id="targetUrl"
            placeholder="https://hooks.zapier.com/... ou https://api.seucrm.com/webhook"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Event selection */}
        <div>
          <Label className="mb-2 block">Eventos que disparam o webhook</Label>
          <div className="grid grid-cols-2 gap-3">
            {WEBHOOK_EVENTS.map((event) => (
              <div
                key={event.id}
                className="flex items-start space-x-2 border rounded-md p-2"
              >
                <Checkbox
                  id={event.id}
                  checked={selectedEvents.includes(event.id)}
                  onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label
                    htmlFor={event.id}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {event.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payload template */}
        <div>
          <Label htmlFor="payloadTemplate">Template do Payload (JSON)</Label>
          <Textarea
            id="payloadTemplate"
            placeholder='{"event": "{{event}}", "data": "{{event_data}}"}'
            value={payloadTemplate}
            onChange={(e) => setPayloadTemplate(e.target.value)}
            className="mt-1 font-mono text-sm"
            rows={6}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use variáveis como {"{{event}}"}, {"{{contact_name}}"}, {"{{contact_phone}}"}, {"{{event_data}}"}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {integration && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!targetUrl.trim() || testWebhookOut.isPending}
            >
              {testWebhookOut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              Testar Webhook
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !targetUrl.trim() || isSaving}
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
