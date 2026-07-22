import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Glasses } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Campo afetado: "Modelo de Lente" no formulário Cadastro Pré-Venda.
// Multifocal e Bifocal foram salvos com o mesmo valor interno "option3".
// Aqui o admin escolhe manualmente Multifocal (option2) ou Bifocal (option3).
const FIELD_ID = "3b0c4a53-8087-4238-8e5e-d721e834a734";
const FIELD_LABEL_KEY = "Modelo de Lente";

type Submission = {
  id: string;
  created_at: string;
  contact_id: string | null;
  deal_id: string | null;
  data: Record<string, any>;
  contact?: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type Choice = "option2" | "option3"; // option2 = Multifocal, option3 = Bifocal

export default function LensFix() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [items, setItems] = useState<Submission[]>([]);
  const [selections, setSelections] = useState<Record<string, Choice>>({});
  const [hideFixed, setHideFixed] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, created_at, contact_id, deal_id, data, contacts:contact_id(name, phone, email)")
        .or(`data->>${FIELD_ID}.eq.option3,data->>${FIELD_LABEL_KEY}.eq.option3`)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      const rows = (data || []).map((r: any) => ({ ...r, contact: r.contacts })) as Submission[];
      setItems(rows);
    } catch (e: any) {
      toast.error("Erro ao carregar cadastros: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(
    () => (hideFixed ? items.filter((i) => !isFixed(i)) : items),
    [items, hideFixed],
  );

  const setChoice = (id: string, choice: Choice) => {
    setSelections((prev) => ({ ...prev, [id]: choice }));
  };

  const saveOne = async (sub: Submission) => {
    const choice = selections[sub.id];
    if (!choice) {
      toast.error("Selecione Multifocal ou Bifocal antes de salvar");
      return;
    }
    setSaving(sub.id);
    try {
      const updated = { ...sub.data };
      const keyById = Object.prototype.hasOwnProperty.call(updated, FIELD_ID);
      const keyByLabel = Object.prototype.hasOwnProperty.call(updated, FIELD_LABEL_KEY);
      if (keyById) updated[FIELD_ID] = choice;
      if (keyByLabel) updated[FIELD_LABEL_KEY] = choice;

      const { error } = await supabase
        .from("form_submissions")
        .update({ data: updated })
        .eq("id", sub.id);
      if (error) throw error;

      setItems((prev) => prev.map((i) => (i.id === sub.id ? { ...i, data: updated } : i)));
      toast.success(`Corrigido para ${choice === "option2" ? "Multifocal" : "Bifocal"}`);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(null);
    }
  };

  const bulkSave = async (choice: Choice) => {
    const pending = visible.filter((i) => !isFixed(i));
    if (pending.length === 0) return;
    if (!confirm(`Aplicar "${choice === "option2" ? "Multifocal" : "Bifocal"}" em ${pending.length} cadastro(s)?`)) return;

    setSaving("__bulk__");
    let ok = 0;
    for (const sub of pending) {
      try {
        const updated = { ...sub.data };
        if (Object.prototype.hasOwnProperty.call(updated, FIELD_ID)) updated[FIELD_ID] = choice;
        if (Object.prototype.hasOwnProperty.call(updated, FIELD_LABEL_KEY)) updated[FIELD_LABEL_KEY] = choice;
        const { error } = await supabase.from("form_submissions").update({ data: updated }).eq("id", sub.id);
        if (error) throw error;
        ok++;
      } catch {
        /* keep going */
      }
    }
    setSaving(null);
    toast.success(`${ok} de ${pending.length} atualizados`);
    load();
  };

  return (
    <AppLayout pageTitle="Corrigir Modelo de Lente">
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Glasses className="h-6 w-6 text-primary" />
              Corrigir Modelo de Lente
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Cadastros antigos do formulário Pré-Venda gravaram o mesmo valor interno para
              Multifocal e Bifocal. Revise cada registro e escolha o modelo correto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHideFixed((v) => !v)}>
              {hideFixed ? "Mostrar já corrigidos" : "Ocultar já corrigidos"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Recarregar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ações em lote</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkSave("option2")} disabled={saving === "__bulk__"}>
              Marcar todos visíveis como Multifocal
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkSave("option3")} disabled={saving === "__bulk__"}>
              Marcar todos visíveis como Bifocal
            </Button>
            <p className="text-xs text-muted-foreground w-full">
              Total encontrado: {items.length} · Pendentes: {items.filter((i) => !isFixed(i)).length}
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum cadastro pendente. 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((sub) => {
              const fixed = isFixed(sub);
              const currentChoice = selections[sub.id];
              const rawValue = sub.data?.[FIELD_ID] ?? sub.data?.[FIELD_LABEL_KEY];
              return (
                <Card key={sub.id} className={fixed ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">
                          {sub.contact?.name || "Sem nome"}
                        </p>
                        {sub.contact?.phone && (
                          <span className="text-xs text-muted-foreground">{sub.contact.phone}</span>
                        )}
                        {fixed && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {rawValue === "option2" ? "Multifocal" : "Bifocal"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enviado em {format(new Date(sub.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={currentChoice === "option2" ? "default" : "outline"}
                        onClick={() => setChoice(sub.id, "option2")}
                        disabled={fixed}
                      >
                        Multifocal
                      </Button>
                      <Button
                        size="sm"
                        variant={currentChoice === "option3" ? "default" : "outline"}
                        onClick={() => setChoice(sub.id, "option3")}
                        disabled={fixed}
                      >
                        Bifocal
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveOne(sub)}
                        disabled={fixed || !currentChoice || saving === sub.id}
                      >
                        {saving === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function isFixed(sub: Submission) {
  const v = sub.data?.[FIELD_ID] ?? sub.data?.[FIELD_LABEL_KEY];
  return v && v !== "option3";
}
