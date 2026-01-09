import { useState } from "react";
import { Target, Plus, ChevronRight, DollarSign, FileText, CheckSquare, AlertCircle, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useFunnels } from "@/hooks/useFunnels";
import { useDealTasks } from "@/hooks/useDealTasks";
import { DealFormDialog } from "@/components/funnels/DealFormDialog";
import { MoveDealFunnelDialog } from "@/components/funnels/MoveDealFunnelDialog";
import { DealTasksSection } from "@/components/funnels/DealTasksSection";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FunnelDealSectionProps {
  contactId: string;
  conversationId?: string;
}

export const FunnelDealSection = ({ contactId, conversationId }: FunnelDealSectionProps) => {
  const { funnels, updateDeal, useContactDeal } = useFunnels();
  const { data: activeDeal, isLoading } = useContactDeal(contactId);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showMoveFunnel, setShowMoveFunnel] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const navigate = useNavigate();

  const { pendingCount, overdueCount } = useDealTasks(activeDeal?.id);

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const handleSaveNotes = async () => {
    if (!activeDeal) return;
    await updateDeal.mutateAsync({ id: activeDeal.id, notes: notesValue });
    setEditingNotes(false);
  };

  const handleStartEditNotes = () => {
    setNotesValue(activeDeal?.notes || "");
    setEditingNotes(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Funil de Vendas</span>
        </div>
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!activeDeal) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Funil de Vendas</span>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Este contato não está em nenhum funil
          </p>
          <Button 
            size="sm" 
            onClick={() => setShowDealForm(true)}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            Adicionar ao Funil
          </Button>
        </div>

        <DealFormDialog
          open={showDealForm}
          onOpenChange={setShowDealForm}
          contactId={contactId}
          conversationId={conversationId}
        />
      </div>
    );
  }

  const currentFunnel = funnels?.find(f => f.id === activeDeal.funnel_id);
  const currentStage = currentFunnel?.stages?.find(s => s.id === activeDeal.stage_id);

  const handleStageChange = async (newStageId: string) => {
    await updateDeal.mutateAsync({ id: activeDeal.id, stage_id: newStageId });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Funil de Vendas</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={() => navigate('/funnels')}
        >
          Ver Funil
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
        {/* Funnel & Stage */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentFunnel?.name}
          </span>
          <Badge 
            variant="outline" 
            style={{ 
              borderColor: currentStage?.color,
              color: currentStage?.color
            }}
          >
            {currentStage?.name}
          </Badge>
        </div>

        {/* Deal Title */}
        {activeDeal.title && (
          <p className="text-sm font-medium">{activeDeal.title}</p>
        )}

        {/* Value */}
        {activeDeal.value > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-3 w-3 text-primary" />
            <span className="font-semibold text-primary">
              {formatCurrency(activeDeal.value, activeDeal.currency || 'BRL')}
            </span>
          </div>
        )}

        {/* Time in Stage */}
        {activeDeal.entered_stage_at && (
          <p className="text-xs text-muted-foreground">
            Na etapa há {formatDistanceToNow(new Date(activeDeal.entered_stage_at), { locale: ptBR })}
          </p>
        )}

        <Separator />

        {/* Quick Stage Change */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mover para:</label>
          <Select 
            value={activeDeal.stage_id} 
            onValueChange={handleStageChange}
            disabled={updateDeal.isPending}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar etapa" />
            </SelectTrigger>
            <SelectContent>
              {currentFunnel?.stages?.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: stage.color }} 
                    />
                    {stage.name}
                    {stage.is_final && (
                      <span className="text-xs text-muted-foreground">
                        ({stage.final_type === 'won' ? 'Ganho' : 'Perdido'})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Move to Another Funnel */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs gap-1.5"
          onClick={() => setShowMoveFunnel(true)}
        >
          <ArrowRightLeft className="h-3 w-3" />
          Mover para outro funil
        </Button>

        <Separator />

        {/* Notes Section */}
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-8 px-2">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs">Notas</span>
              </div>
              <ChevronRight className={cn(
                "h-3.5 w-3.5 transition-transform",
                notesOpen && "rotate-90"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Adicionar notas..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingNotes(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes}
                    disabled={updateDeal.isPending}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="text-sm text-muted-foreground p-2 bg-background rounded border cursor-pointer hover:bg-muted/50 min-h-[60px]"
                onClick={handleStartEditNotes}
              >
                {activeDeal.notes || (
                  <span className="italic">Clique para adicionar notas...</span>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Tasks Section */}
        <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-8 px-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="text-xs">Tarefas</span>
                {pendingCount > 0 && (
                  <Badge 
                    variant={overdueCount > 0 ? "destructive" : "secondary"}
                    className="h-4 px-1 text-[10px]"
                  >
                    {overdueCount > 0 && <AlertCircle className="h-2.5 w-2.5 mr-0.5" />}
                    {pendingCount}
                  </Badge>
                )}
              </div>
              <ChevronRight className={cn(
                "h-3.5 w-3.5 transition-transform",
                tasksOpen && "rotate-90"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <DealTasksSection dealId={activeDeal.id} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Move to Another Funnel Dialog */}
      <MoveDealFunnelDialog
        deal={activeDeal as any}
        currentFunnelId={activeDeal.funnel_id}
        open={showMoveFunnel}
        onOpenChange={setShowMoveFunnel}
      />
    </div>
  );
};
