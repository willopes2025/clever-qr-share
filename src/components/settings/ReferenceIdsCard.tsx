import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Hash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("ID copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function ReferenceIdsCard() {
  const { data: funnels = [] } = useQuery({
    queryKey: ["ref-funnels"],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id, name, is_default").order("name");
      return data ?? [];
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["ref-stages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnel_stages")
        .select("id, name, funnel_id, display_order, color, final_type")
        .order("display_order");
      return data ?? [];
    },
    enabled: funnels.length > 0,
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["ref-custom-fields"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_fields").select("id, name, field_type").order("name");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4" />
            IDs de Referência para a API
          </CardTitle>
          <CardDescription>
            Use estes IDs nos requests da API pública (funnel_id, stage_id, custom_field_id).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Funis */}
          <div>
            <h4 className="text-sm font-medium mb-2">Funis</h4>
            {funnels.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum funil encontrado.</p>
            ) : (
              <div className="space-y-1">
                {funnels.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">{f.id}</code>
                    <CopyButton text={f.id} />
                    <span>{f.name}</span>
                    {f.is_default && <Badge variant="default" className="text-[10px] px-1">padrão</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estágios */}
          <div>
            <h4 className="text-sm font-medium mb-2">Estágios</h4>
            {stages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum estágio encontrado.</p>
            ) : (
              <div className="space-y-1">
                {stages.map((s) => {
                  const funnel = funnels.find((f) => f.id === s.funnel_id);
                  return (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">{s.id}</code>
                      <CopyButton text={s.id} />
                      <span>{s.name}</span>
                      {funnel && <span className="text-muted-foreground">({funnel.name})</span>}
                      {s.color && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: s.color }} />}
                      {s.final_type && <Badge variant="secondary" className="text-[10px] px-1">{s.final_type}</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          <div>
            <h4 className="text-sm font-medium mb-2">Campos Customizados</h4>
            {customFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum campo customizado encontrado.</p>
            ) : (
              <div className="space-y-1">
                {customFields.map((cf) => (
                  <div key={cf.id} className="flex items-center gap-2 text-xs">
                    <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">{cf.id}</code>
                    <CopyButton text={cf.id} />
                    <span>{cf.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1">{cf.field_type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formato de exemplo */}
          <div className="rounded-md bg-muted/30 p-3 text-xs">
            <p className="font-medium mb-1">Formato no body do request:</p>
            <pre className="font-mono text-[10px]">{`{
  "funnel_id": "uuid-do-funil",
  "stage_id": "uuid-do-estagio",
  "custom_fields": [
    {"custom_field_id": "uuid-do-campo", "value": "valor"}
  ]
}`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
