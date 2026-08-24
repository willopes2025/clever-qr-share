/** Helpers compartilhados pelas tabelas do Gestão Parts */

export const money = (v: unknown): string => {
  const n = num(v);
  return n !== null ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";
};

export const text = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() ? s : "-";
};

export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** AAAA-MM-DD -> DD/MM/AAAA (mantém o valor cru quando não reconhece) */
export const brDate = (v: unknown): string => {
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s || "-";
};

/** Extrai lista de registros de qualquer formato retornado pelo ERP */
export const toRecords = (raw: unknown, keys: string[] = []): Record<string, unknown>[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter((r) => r && typeof r === "object") as Record<string, unknown>[];
      }
    }
    return [obj];
  }
  return [];
};

/** Busca o primeiro valor preenchido entre chaves alternativas (case-insensitive) */
export const pick = (rec: Record<string, unknown>, keys: string[]): unknown => {
  const lower = Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Achata um registro em texto pesquisável (inclui objetos e listas aninhadas) */
const flatten = (value: unknown, depth = 0): string => {
  if (value === null || value === undefined) return "";
  if (depth > 3) return "";
  if (Array.isArray(value)) return value.map((v) => flatten(v, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map((v) => flatten(v, depth + 1)).join(" ");
  }
  return String(value);
};

/** Filtra registros já carregados por um termo digitado pelo usuário */
export const filterRecords = <T,>(rows: T[], term: string): T[] => {
  const q = normalize(term.trim());
  if (!q) return rows;
  const parts = q.split(/\s+/);
  return rows.filter((row) => {
    const haystack = normalize(flatten(row));
    return parts.every((p) => haystack.includes(p));
  });
};
