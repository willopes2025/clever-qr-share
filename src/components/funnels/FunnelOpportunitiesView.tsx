import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Phone, Mail, Loader2, RefreshCw, ExternalLink, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ContactIdBadge } from "@/components/contacts/ContactIdBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OpportunityBroadcastDialog } from "./OpportunityBroadcastDialog";

interface Opportunity {
  id?: string;
  deal_id: string;
  contact_id?: string;
  conversation_id?: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_display_id?: string | null;
  stage_name: string;
  value: number;
  score: number;
  insight: string;
  user_notes?: string | null;
  status?: string;
}

interface Props {
  funnel: { id: string; name: string };
}

const STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "contacted", label: "Contactado" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
];

export const FunnelOpportunitiesView = ({ funnel }: Props) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [showBroadcast, setShowBroadcast] = useState(false);
  const cacheRef = useRef<Record<string, boolean>>({});

  // Load persisted opportunities from DB on mount
  useEffect(() => {
    loadFromDB();
  }, [funnel.id]);

  const loadFromDB = async () => {
    const { data, error } = await supabase
      .from("funnel_opportunities")
      .select("*")
      .eq("funnel_id", funnel.id)
      .order("score", { ascending: false });

    if (!error && data?.length) {
      setOpportunities(data as Opportunity[]);
      setHasLoaded(true);
    }
  };

  const analyze = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-funnel-opportunities", {
        body: { funnel_id: funnel.id },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Reload from DB to get persisted data with user_notes/status
      await loadFromDB();
      // If loadFromDB didn't find data, use API response
      if (!opportunities.length) {
        const results = data?.opportunities || [];
        setOpportunities(results);
      }
      setHasLoaded(true);
      cacheRef.current[funnel.id] = true;
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao analisar oportunidades");
    } finally {
      setIsLoading(false);
    }
  };

  const reAnalyze = async () => {
    delete cacheRef.current[funnel.id];
    await analyze();
  };

  const updateField = useCallback(async (dealId: string, field: string, value: string) => {
    const { error } = await supabase
      .from("funnel_opportunities")
      .update({ [field]: value })
      .eq("funnel_id", funnel.id)
      .eq("deal_id", dealId);

    if (error) {
      toast.error("Erro ao salvar");
      return;
    }

    setOpportunities((prev) =>
      prev.map((opp) => (opp.deal_id === dealId ? { ...opp, [field]: value } : opp))
    );
  }, [funnel.id]);

  const openConversation = (opp: Opportunity) => {
    if (opp.conversation_id) {
      window.open(`/inbox?conversationId=${opp.conversation_id}`, "_blank");
    } else if (opp.contact_id) {
      window.open(`/inbox?contactId=${opp.contact_id}`, "_blank");
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 font-bold text-sm">{score}</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 font-bold text-sm">{score}</Badge>;
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold text-sm">{score}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status);
    return opt?.label || status;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const toggleSelect = (dealId: string) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId); else next.add(dealId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDealIds.size === opportunities.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(opportunities.map(o => o.deal_id)));
    }
  };

  const selectedContacts = useMemo(() => {
    return opportunities
      .filter(o => selectedDealIds.has(o.deal_id) && o.contact_id)
      .map(o => ({ contactId: o.contact_id!, contactName: o.contact_name }));
  }, [selectedDealIds, opportunities]);

  const exportToCSV = () => {
    if (!opportunities.length) return;
    const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s;
    const headers = ["Score", "ID", "Nome", "Telefone", "Email", "Etapa", "Valor", "Status", "Insight", "Anotações"];
    const rows = opportunities.map((opp) => [
      opp.score,
      opp.contact_display_id || "",
      opp.contact_name,
      opp.contact_phone,
      opp.contact_email,
      opp.stage_name,
      opp.value || 0,
      statusLabel(opp.status || "open"),
      `"${(opp.insight || "").replace(/"/g, '""')}"`,
      `"${(opp.user_notes || "").replace(/"/g, '""')}"`,
    ]);
    const BOM = "\uFEFF";
    const csv = BOM + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oportunidades-${funnel.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  };

  if (!hasLoaded && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Análise de Oportunidades com IA</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          A IA analisará as conversas dos deals abertos deste funil e identificará as melhores oportunidades de fechamento.
        </p>
        <Button onClick={analyze} size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          Analisar Oportunidades
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-semibold mb-2">Analisando oportunidades...</h3>
        <p className="text-muted-foreground">A IA está avaliando as conversas e dados dos deals. Isso pode levar alguns segundos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {opportunities.length} oportunidade{opportunities.length !== 1 ? "s" : ""} analisada{opportunities.length !== 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-muted-foreground">Ordenadas por probabilidade de fechamento</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDealIds.size > 0 && (
            <Button size="sm" onClick={() => setShowBroadcast(true)}>
              <Send className="h-4 w-4 mr-2" />
              Disparar ({selectedDealIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!opportunities.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={reAnalyze}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-analisar
          </Button>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum deal aberto encontrado neste funil.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={opportunities.length > 0 && selectedDealIds.size === opportunities.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[80px]">Score</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="min-w-[200px]">Insight da IA</TableHead>
                <TableHead className="min-w-[200px]">Anotações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow key={opp.deal_id} className={selectedDealIds.has(opp.deal_id) ? "bg-muted/50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDealIds.has(opp.deal_id)}
                      onCheckedChange={() => toggleSelect(opp.deal_id)}
                    />
                  </TableCell>
                  <TableCell>{getScoreBadge(opp.score)}</TableCell>
                  <TableCell>
                    <ContactIdBadge displayId={opp.contact_display_id} size="sm" />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openConversation(opp)}
                      className="font-medium text-primary hover:underline flex items-center gap-1 text-left"
                      title="Abrir conversa em nova aba"
                    >
                      {opp.contact_name}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                    </button>
                  </TableCell>
                  <TableCell>
                    {opp.contact_phone ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {opp.contact_phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {opp.contact_email ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {opp.contact_email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{opp.stage_name}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {opp.value ? formatCurrency(opp.value) : "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={opp.status || "open"}
                      onValueChange={(val) => updateField(opp.deal_id, "status", val)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{opp.insight}</TableCell>
                  <TableCell>
                    <Textarea
                      className="text-xs min-h-[60px] resize-none"
                      placeholder="Adicionar anotação..."
                      value={editingNotes[opp.deal_id] ?? opp.user_notes ?? ""}
                      onChange={(e) =>
                        setEditingNotes((prev) => ({ ...prev, [opp.deal_id]: e.target.value }))
                      }
                      onBlur={() => {
                        const val = editingNotes[opp.deal_id];
                        if (val !== undefined && val !== (opp.user_notes ?? "")) {
                          updateField(opp.deal_id, "user_notes", val);
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <OpportunityBroadcastDialog
        open={showBroadcast}
        onOpenChange={setShowBroadcast}
        selectedContacts={selectedContacts}
        funnelName={funnel.name}
      />
    </div>
  );
};
