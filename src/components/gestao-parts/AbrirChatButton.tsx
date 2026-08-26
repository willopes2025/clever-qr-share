import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toTitleCase } from "@/lib/utils";

const FAKE_PHONES = /^(0+|9+|1+|0{2}9{9})$/;
const PHONE_KEY = /(fone|tel|celul|cel$|whats|zap)/i;
const DDD_KEY = /^dd[di]/i;

/** Varre o registro do ERP (inclusive aninhado) procurando telefones válidos */
export const collectPhones = (value: unknown, keyHint = "", depth = 0): string[] => {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    if (!PHONE_KEY.test(keyHint)) return [];
    const digits = String(value).replace(/\D/g, "");
    if (digits.length < 8 || FAKE_PHONES.test(digits)) return [];
    return [digits];
  }
  if (Array.isArray(value)) return value.flatMap((v) => collectPhones(v, keyHint, depth + 1));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const ddd = Object.entries(obj).find(([k]) => DDD_KEY.test(k))?.[1];
    const dddDigits = String(ddd ?? "").replace(/\D/g, "");
    return Object.entries(obj).flatMap(([k, v]) => {
      const hint = PHONE_KEY.test(k) ? k : /(fones|contato|telefones)/i.test(k) ? "fone" : keyHint;
      return collectPhones(v, hint, depth + 1).map((p) =>
        p.length === 8 || p.length === 9 ? (dddDigits.length === 2 ? dddDigits + p : p) : p,
      );
    });
  }
  return [];
};

/** Melhor telefone do registro (prefere celular) */
export const bestPhone = (record: unknown): string => {
  const all = collectPhones(record).filter((p) => p.replace(/^55/, "").length >= 10);
  return all.find((p) => p.replace(/^55/, "").length === 11) ?? all[0] ?? "";
};

/** Telefone no padrão do CRM: 55 + DDD + número */
export const toCrmPhone = (digits: string): string => {
  if (!digits) return "";
  const d = String(digits).replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
};

interface AbrirChatButtonProps {
  phone: string;
  name?: string;
  email?: string | null;
  extraFields?: Record<string, unknown>;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  className?: string;
}

/**
 * Abre (ou cria) a conversa do cliente no Inbox a partir de um registro do ERP.
 */
export const AbrirChatButton = ({
  phone,
  name,
  email,
  extraFields,
  size = "sm",
  variant = "outline",
  className,
}: AbrirChatButtonProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const crmPhone = toCrmPhone(phone);
  const disabled = crmPhone.length < 12;

  const abrir = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", crmPhone)
        .limit(1)
        .maybeSingle();

      let contactId = existing?.id;

      if (!contactId) {
        const { data: created, error } = await supabase
          .from("contacts")
          .insert({
            user_id: user.id,
            name: toTitleCase(name || "") || "Cliente ERP",
            phone: crmPhone,
            email: email || null,
            custom_fields: { origem: "Gestão Parts", ...(extraFields ?? {}) } as never,
          })
          .select("id")
          .single();
        if (error) throw error;
        contactId = created.id;
      }

      navigate(`/inbox?contactId=${contactId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir conversa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={abrir}
      disabled={disabled || loading}
      title={disabled ? "Cliente sem telefone válido no ERP" : "Abrir conversa no Inbox"}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
      )}
      Abrir chat
    </Button>
  );
};
