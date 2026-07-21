// Visual "mala direta" email designer — schema + HTML compiler.
// Produces email-client-safe HTML (tables, inline styles, max 600px wide).

export type EmailBlock =
  | { id: string; type: "header"; title: string; subtitle?: string; bgColor: string; textColor: string; logoUrl?: string }
  | { id: string; type: "text"; content: string; align?: "left" | "center" | "right" }
  | { id: string; type: "image"; url: string; alt?: string; href?: string; width?: number }
  | { id: string; type: "button"; label: string; href: string; bgColor: string; textColor: string; align?: "left" | "center" | "right" }
  | { id: string; type: "divider"; color?: string }
  | { id: string; type: "columns"; left: string; right: string }
  | { id: string; type: "footer"; text: string };

export interface EmailDesign {
  version: 1;
  bg: string;          // page background
  cardBg: string;      // 600px content card
  fontFamily: string;
  blocks: EmailBlock[];
}

export const defaultDesign = (brandColor = "#0f766e"): EmailDesign => ({
  version: 1,
  bg: "#f4f5f7",
  cardBg: "#ffffff",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  blocks: [
    { id: crypto.randomUUID(), type: "header", title: "Olá, {{nome}}!", subtitle: "Uma novidade pra você", bgColor: brandColor, textColor: "#ffffff" },
    { id: crypto.randomUUID(), type: "text", content: "Este é um exemplo de e-mail no formato mala direta. Edite os blocos ao lado.", align: "left" },
    { id: crypto.randomUUID(), type: "button", label: "Acessar agora", href: "https://exemplo.com", bgColor: brandColor, textColor: "#ffffff", align: "center" },
    { id: crypto.randomUUID(), type: "divider", color: "#e5e7eb" },
    { id: crypto.randomUUID(), type: "footer", text: "Você recebeu este e-mail porque está em nossa lista." },
  ],
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// keep simple inline formatting for user text (b, i, u, a, br, p)
const cleanRich = (s: string) => {
  // allow {{vars}} to pass through
  return s.replace(/\r?\n/g, "<br/>");
};

function renderBlock(b: EmailBlock): string {
  const pad = 'padding:16px 24px;';
  switch (b.type) {
    case "header":
      return `
<tr><td style="background:${b.bgColor};color:${b.textColor};padding:32px 24px;text-align:center;">
  ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="" style="max-height:48px;margin-bottom:12px;display:inline-block;"/>` : ""}
  <div style="font-size:22px;font-weight:700;line-height:1.2;">${cleanRich(esc(b.title))}</div>
  ${b.subtitle ? `<div style="font-size:14px;opacity:.85;margin-top:6px;">${cleanRich(esc(b.subtitle))}</div>` : ""}
</td></tr>`;
    case "text":
      return `<tr><td style="${pad}font-size:15px;line-height:1.6;color:#111827;text-align:${b.align ?? "left"};">${cleanRich(esc(b.content))}</td></tr>`;
    case "image": {
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt ?? "")}" width="${b.width ?? 552}" style="display:block;max-width:100%;height:auto;border:0;margin:0 auto;"/>`;
      const wrapped = b.href ? `<a href="${esc(b.href)}" target="_blank" style="text-decoration:none;">${img}</a>` : img;
      return `<tr><td style="padding:8px 24px;text-align:center;">${wrapped}</td></tr>`;
    }
    case "button":
      return `<tr><td style="${pad}text-align:${b.align ?? "center"};">
  <a href="${esc(b.href)}" target="_blank" style="display:inline-block;background:${b.bgColor};color:${b.textColor};padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px;text-decoration:none;">${esc(b.label)}</a>
</td></tr>`;
    case "divider":
      return `<tr><td style="padding:8px 24px;"><div style="height:1px;background:${b.color ?? "#e5e7eb"};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>`;
    case "columns":
      return `<tr><td style="padding:8px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" style="padding:12px;font-size:14px;line-height:1.6;color:#111827;width:50%;">${cleanRich(esc(b.left))}</td>
    <td valign="top" style="padding:12px;font-size:14px;line-height:1.6;color:#111827;width:50%;">${cleanRich(esc(b.right))}</td>
  </tr></table>
</td></tr>`;
    case "footer":
      return `<tr><td style="padding:24px;text-align:center;font-size:12px;color:#6b7280;line-height:1.5;">${cleanRich(esc(b.text))}</td></tr>`;
  }
}

export function compileDesignToHtml(design: EmailDesign, subject: string): string {
  const inner = design.blocks.map(renderBlock).join("\n");
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${design.bg};font-family:${design.fontFamily};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${design.bg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${design.cardBg};border-radius:8px;overflow:hidden;">
      ${inner}
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function newBlock(type: EmailBlock["type"], brandColor = "#0f766e"): EmailBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "header": return { id, type, title: "Título aqui", subtitle: "Subtítulo opcional", bgColor: brandColor, textColor: "#ffffff" };
    case "text": return { id, type, content: "Escreva seu texto aqui. Use {{nome}} para personalizar.", align: "left" };
    case "image": return { id, type, url: "https://placehold.co/600x300/png", alt: "", width: 552 };
    case "button": return { id, type, label: "Clique aqui", href: "https://", bgColor: brandColor, textColor: "#ffffff", align: "center" };
    case "divider": return { id, type, color: "#e5e7eb" };
    case "columns": return { id, type, left: "Coluna esquerda", right: "Coluna direita" };
    case "footer": return { id, type, text: "Você recebeu este e-mail porque está em nossa lista." };
  }
}
