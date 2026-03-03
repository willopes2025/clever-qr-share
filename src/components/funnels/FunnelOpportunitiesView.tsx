import { useState, useRef } from "react";
import { Sparkles, Phone, Mail, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Opportunity {
  deal_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  stage_name: string;
  value: number;
  score: number;
  insight: string;
}

interface Props {
  funnel: { id: string; name: string };
}

export const FunnelOpportunitiesView = ({ funnel }: Props) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const cacheRef = useRef<Record<string, Opportunity[]>>({});

  const analyze = async () => {
    // Check cache
    if (cacheRef.current[funnel.id]) {
      setOpportunities(cacheRef.current[funnel.id]);
      setHasAnalyzed(true);
      return;
    }

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

      const results = data?.opportunities || [];
      setOpportunities(results);
      cacheRef.current[funnel.id] = results;
      setHasAnalyzed(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao analisar oportunidades");
    } finally {
      setIsLoading(false);
    }
  };

  const reAnalyze = async () => {
    delete cacheRef.current[funnel.id];
    setHasAnalyzed(false);
    setOpportunities([]);
    await analyze();
  };

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 font-bold text-sm">{score}</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 font-bold text-sm">{score}</Badge>;
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold text-sm">{score}</Badge>;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (!hasAnalyzed && !isLoading) {
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
        <Button variant="outline" size="sm" onClick={reAnalyze}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-analisar
        </Button>
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
                <TableHead className="w-[80px]">Score</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="min-w-[250px]">Insight da IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp) => (
                <TableRow key={opp.deal_id}>
                  <TableCell>{getScoreBadge(opp.score)}</TableCell>
                  <TableCell className="font-medium">{opp.contact_name}</TableCell>
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
                  <TableCell className="text-sm text-muted-foreground">{opp.insight}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
