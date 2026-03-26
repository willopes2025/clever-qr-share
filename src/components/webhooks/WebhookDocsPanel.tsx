import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WebhookDocsPanel() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Como usar o Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Use a URL do webhook para enviar requisições POST a partir do Make, Zapier ou qualquer ferramenta de automação.
          </p>
          
          <div>
            <h3 className="font-semibold mb-2">Formato da requisição</h3>
            <pre className="bg-muted/50 p-4 rounded text-xs overflow-auto">{`POST {webhook_url}
Content-Type: application/json

{
  "action": "nome_da_acao",
  ...campos específicos
}`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Ações disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <ActionDoc
            action="send_message"
            description="Envia mensagem WhatsApp para um contato"
            fields={[
              { name: "phone", desc: "Número do contato (ex: 5511999999999)", required: true },
              { name: "message", desc: "Texto da mensagem", required: true },
              { name: "instance_id", desc: "ID da instância WhatsApp (opcional se contato já tem conversa)", required: false },
            ]}
          />
          <ActionDoc
            action="create_lead"
            description="Cria contato e opcionalmente um deal no funil"
            fields={[
              { name: "phone", desc: "Número do contato", required: true },
              { name: "name", desc: "Nome do contato", required: false },
              { name: "email", desc: "Email do contato", required: false },
              { name: "funnel_id", desc: "ID do funil para criar deal", required: false },
              { name: "stage_id", desc: "ID da etapa (se não informado, usa a primeira)", required: false },
              { name: "deal_title", desc: "Título do deal", required: false },
              { name: "deal_value", desc: "Valor do deal", required: false },
            ]}
          />
          <ActionDoc
            action="create_deal"
            description="Cria deal no funil para um contato existente"
            fields={[
              { name: "contact_id", desc: "ID do contato (ou phone)", required: false },
              { name: "phone", desc: "Número do contato (alternativa ao contact_id)", required: false },
              { name: "funnel_id", desc: "ID do funil", required: true },
              { name: "stage_id", desc: "ID da etapa (opcional)", required: false },
              { name: "title", desc: "Título do deal", required: false },
              { name: "value", desc: "Valor", required: false },
            ]}
          />
          <ActionDoc
            action="move_deal"
            description="Move deal para outra etapa do funil"
            fields={[
              { name: "deal_id", desc: "ID do deal (ou phone)", required: false },
              { name: "phone", desc: "Número do contato (busca deal mais recente)", required: false },
              { name: "stage_id", desc: "ID da etapa de destino", required: true },
            ]}
          />
          <ActionDoc
            action="update_contact"
            description="Atualiza dados de um contato"
            fields={[
              { name: "contact_id", desc: "ID do contato (ou phone)", required: false },
              { name: "phone", desc: "Número do contato", required: false },
              { name: "name", desc: "Novo nome", required: false },
              { name: "email", desc: "Novo email", required: false },
              { name: "notes", desc: "Notas", required: false },
              { name: "custom_fields", desc: "Campos personalizados (JSON)", required: false },
            ]}
          />
          <ActionDoc
            action="add_tag / remove_tag"
            description="Adiciona ou remove tag de um contato"
            fields={[
              { name: "contact_id", desc: "ID do contato (ou phone)", required: false },
              { name: "phone", desc: "Número do contato", required: false },
              { name: "tag_name", desc: "Nome da tag (cria automaticamente se não existir)", required: false },
              { name: "tag_id", desc: "ID da tag (alternativa ao tag_name)", required: false },
            ]}
          />
          <ActionDoc
            action="get_contact_info"
            description="Retorna dados do contato, tags e deals"
            fields={[
              { name: "contact_id", desc: "ID do contato (ou phone)", required: false },
              { name: "phone", desc: "Número do contato", required: false },
            ]}
          />
          <ActionDoc
            action="get_deal_info"
            description="Retorna dados completos de um deal"
            fields={[
              { name: "deal_id", desc: "ID do deal", required: true },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ActionDoc({ action, description, fields }: {
  action: string;
  description: string;
  fields: { name: string; desc: string; required: boolean }[];
}) {
  return (
    <div className="border-t border-border/50 pt-4 first:border-0 first:pt-0">
      <h4 className="font-mono font-bold text-primary">{action}</h4>
      <p className="text-muted-foreground mb-2">{description}</p>
      <div className="space-y-1">
        {fields.map(f => (
          <div key={f.name} className="flex items-center gap-2 text-xs">
            <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">{f.name}</code>
            <span className="text-muted-foreground">{f.desc}</span>
            {f.required && <span className="text-destructive text-[10px] font-medium">obrigatório</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
