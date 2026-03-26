export type InferableFieldType = "text" | "number" | "date" | "time" | "email" | "phone" | "url";

const RULES: { keywords: string[]; type: InferableFieldType }[] = [
  { keywords: ["data", "nascimento", "vencimento", "aniversário"], type: "date" },
  { keywords: ["hora", "horário", "horario"], type: "time" },
  { keywords: ["email", "e-mail"], type: "email" },
  { keywords: ["telefone", "celular", "whatsapp", "fone"], type: "phone" },
  { keywords: ["url", "site", "link", "website"], type: "url" },
  { keywords: ["valor", "preço", "preco", "custo", "salário", "salario", "renda"], type: "number" },
];

export function inferFieldType(name: string): InferableFieldType {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(normalizedKeyword)) {
        return rule.type;
      }
    }
  }

  return "text";
}
