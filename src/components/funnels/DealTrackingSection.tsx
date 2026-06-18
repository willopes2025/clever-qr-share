import { Badge } from "@/components/ui/badge";
import { ExternalLink, Megaphone, Globe, Tag } from "lucide-react";

interface DealTrackingSectionProps {
  tracking?: Record<string, any> | null;
}

const LABELS: Record<string, string> = {
  utm_source: "Origem",
  utm_medium: "Mídia",
  utm_campaign: "Campanha",
  utm_content: "Conteúdo",
  utm_term: "Termo",
  gclid: "Google Click ID",
  fbclid: "Facebook Click ID",
  referrer: "Referenciador",
  landing_url: "Página de entrada",
  ad_source: "Plataforma do anúncio",
  ad_headline: "Título do anúncio",
  ad_body: "Texto do anúncio",
  ad_source_url: "URL do anúncio",
  ad_source_id: "ID do anúncio",
  ad_source_type: "Tipo de anúncio",
  ad_ctwa_clid: "CTWA Click ID",
  origin_channel: "Canal de origem",
  form_id: "Formulário",
};

const ORDER = [
  "origin_channel",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "ad_source", "ad_headline", "ad_source_url", "ad_source_id", "ad_ctwa_clid",
  "gclid", "fbclid", "referrer", "landing_url", "form_id",
];

export const DealTrackingSection = ({ tracking }: DealTrackingSectionProps) => {
  if (!tracking || Object.keys(tracking).length === 0) return null;

  const keys = ORDER.filter((k) => tracking[k]).concat(
    Object.keys(tracking).filter((k) => !ORDER.includes(k) && tracking[k])
  );

  const Icon = tracking.origin_channel === "click_to_whatsapp"
    ? Megaphone
    : tracking.origin_channel === "form"
      ? Tag
      : Globe;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        Origem do lead
      </div>
      <div className="grid grid-cols-1 gap-1.5 text-xs">
        {keys.map((k) => {
          const v = tracking[k];
          const label = LABELS[k] || k;
          const isUrl = typeof v === "string" && /^https?:\/\//i.test(v);
          return (
            <div key={k} className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground shrink-0">{label}:</span>
              {isUrl ? (
                <a
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium truncate text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span className="truncate">{v}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="font-medium text-right break-all">{String(v)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TrackingBadgeProps {
  tracking?: Record<string, any> | null;
}

export const DealTrackingBadge = ({ tracking }: TrackingBadgeProps) => {
  if (!tracking) return null;
  const source =
    tracking.utm_source ||
    tracking.ad_source ||
    (tracking.origin_channel === "click_to_whatsapp" ? "Anúncio WhatsApp" : null);
  if (!source) return null;
  const campaign = tracking.utm_campaign || tracking.ad_headline;
  return (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-0.5 max-w-full">
      <Megaphone className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {String(source)}
        {campaign ? ` · ${String(campaign)}` : ""}
      </span>
    </Badge>
  );
};
