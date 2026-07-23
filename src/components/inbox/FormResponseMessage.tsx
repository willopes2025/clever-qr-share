import { ClipboardList } from "lucide-react";

interface FormResponseField {
  key?: string;
  label: string;
  value: string;
}

interface FormResponsePayload {
  type: "form_response";
  title?: string;
  fields: FormResponseField[];
  source?: string;
}

interface FormResponseMessageProps {
  content: string;
}

export const FormResponseMessage = ({ content }: FormResponseMessageProps) => {
  let data: FormResponsePayload | null = null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "form_response" && Array.isArray(parsed.fields)) {
      data = parsed;
    }
  } catch {
    return null;
  }
  if (!data) return null;

  return (
    <div className="min-w-[240px] max-w-[340px] rounded-lg bg-background/60 border border-border/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-border/50">
        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">
          {data.title || "Resposta ao formulário"}
        </span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {data.fields.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem campos.</p>
        )}
        {data.fields.map((f, i) => (
          <div key={i} className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {f.label}
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">
              {f.value || "—"}
            </p>
          </div>
        ))}
        {data.source && (
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 mt-2">
            {data.source === "whatsapp_flow"
              ? "Formulário do WhatsApp"
              : data.source === "meta_lead_ads"
              ? "Lead Ad (Meta)"
              : data.source}
          </p>
        )}
      </div>
    </div>
  );
};
