import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLANS } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

interface UserWithSubscription {
  id: string;
  email: string;
  created_at: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    max_instances: number;
    max_messages: number | null;
    max_contacts: number | null;
    current_period_end: string | null;
    stripe_subscription_id: string | null;
  } | null;
}

interface EditSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithSubscription | null;
  onSuccess: () => void;
}

export const EditSubscriptionDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess
}: EditSubscriptionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState("free");
  const [status, setStatus] = useState("active");
  const [maxInstances, setMaxInstances] = useState("1");
  const [maxMessages, setMaxMessages] = useState("");
  const [maxContacts, setMaxContacts] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (user?.subscription) {
      setPlan(user.subscription.plan || "free");
      setStatus(user.subscription.status || "active");
      setMaxInstances(String(user.subscription.max_instances || 1));
      setMaxMessages(user.subscription.max_messages ? String(user.subscription.max_messages) : "");
      setMaxContacts(user.subscription.max_contacts ? String(user.subscription.max_contacts) : "");
      setPeriodEnd(user.subscription.current_period_end 
        ? new Date(user.subscription.current_period_end).toISOString().split('T')[0] 
        : "");
    } else {
      // Reset para criar nova assinatura
      setPlan("free");
      setStatus("active");
      setMaxInstances("1");
      setMaxMessages("");
      setMaxContacts("");
      setPeriodEnd("");
    }
    setNotes("");
  }, [user]);

  const handlePlanChange = (newPlan: string) => {
    setPlan(newPlan);
    // Auto-preencher limites baseado no plano
    const planConfig = PLANS[newPlan as keyof typeof PLANS];
    if (planConfig) {
      setMaxInstances(planConfig.maxInstances ? String(planConfig.maxInstances) : "");
      setMaxMessages(planConfig.maxMessages ? String(planConfig.maxMessages) : "");
      setMaxContacts(planConfig.maxContacts ? String(planConfig.maxContacts) : "");
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updates = {
        plan,
        status,
        max_instances: parseInt(maxInstances) || 1,
        max_messages: maxMessages ? parseInt(maxMessages) : null,
        max_contacts: maxContacts ? parseInt(maxContacts) : null,
        current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null
      };

      const action = user.subscription ? 'update' : 'create';
      const body: Record<string, unknown> = {
        action,
        updates,
        notes
      };

      if (user.subscription) {
        body.subscriptionId = user.subscription.id;
      } else {
        body.userId = user.id;
      }

      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body
      });

      if (error) throw error;

      toast.success(user.subscription ? 'Assinatura atualizada com sucesso!' : 'Assinatura criada com sucesso!');
      onSuccess();
    } catch (err) {
      console.error('Error updating subscription:', err);
      toast.error('Erro ao atualizar assinatura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {user?.subscription ? 'Editar Assinatura' : 'Criar Assinatura'}
          </DialogTitle>
          <DialogDescription>
            {user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select value={plan} onValueChange={handlePlanChange}>
                <SelectTrigger id="plan" className="rounded-xl">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="past_due">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxInstances">Instâncias</Label>
              <Input
                id="maxInstances"
                type="number"
                value={maxInstances}
                onChange={(e) => setMaxInstances(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxMessages">Mensagens</Label>
              <Input
                id="maxMessages"
                type="number"
                placeholder="∞"
                value={maxMessages}
                onChange={(e) => setMaxMessages(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxContacts">Contatos</Label>
              <Input
                id="maxContacts"
                type="number"
                placeholder="∞"
                value={maxContacts}
                onChange={(e) => setMaxContacts(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodEnd">Válido até</Label>
            <Input
              id="periodEnd"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Motivo da alteração..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-hover"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user?.subscription ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
