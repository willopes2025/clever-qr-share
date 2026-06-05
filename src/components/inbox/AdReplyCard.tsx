import { ExternalLink, Facebook, Instagram, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdReply {
  source?: string | null;
  headline?: string | null;
  body?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  media_type?: string | null;
  thumbnail_url?: string | null;
  ctwa_clid?: string | null;
}

interface AdReplyCardProps {
  adReply: AdReply;
  isOutbound?: boolean;
}

export const AdReplyCard = ({ adReply, isOutbound }: AdReplyCardProps) => {
  const url = adReply.source_url || "";
  const isInstagram = /instagram\.com/i.test(url) || adReply.source_type === "ad" && /instagram/i.test(adReply.source_id || "");
  const isFacebook = /facebook\.com|fb\.com/i.test(url);
  const Icon = isInstagram ? Instagram : isFacebook ? Facebook : Megaphone;
  const platformLabel = isInstagram ? "Instagram" : isFacebook ? "Facebook" : "Anúncio";

  const Content = (
    <div
      className={cn(
        "mb-1.5 rounded-md overflow-hidden border-l-4 max-w-[320px]",
        isOutbound
          ? "bg-black/5 dark:bg-black/20 border-[#06cf9c]"
          : "bg-black/5 dark:bg-white/5 border-primary"
      )}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[11px] font-medium opacity-80">
        <Icon className="h-3 w-3" />
        <span>Conversa iniciada por anúncio do {platformLabel}</span>
      </div>
      {adReply.thumbnail_url && (
        <div className="relative w-full bg-black/10 dark:bg-black/40">
          <img
            src={adReply.thumbnail_url}
            alt={adReply.headline || "Anúncio"}
            className="w-full max-h-[180px] object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="px-2 py-1.5 space-y-0.5">
        {adReply.headline && (
          <p className="text-[13px] font-semibold leading-tight line-clamp-2">
            {adReply.headline}
          </p>
        )}
        {adReply.body && (
          <p className="text-[12px] opacity-80 leading-snug line-clamp-3">
            {adReply.body}
          </p>
        )}
        {url && (
          <div className="flex items-center gap-1 pt-0.5 text-[11px] text-primary truncate">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-95 transition-opacity">
        {Content}
      </a>
    );
  }
  return Content;
};
