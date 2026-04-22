import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (userId: string, label: string) => void;
}

export const AddSdrDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!userId.trim() || !orgId.trim()) {
      toast.error("Preencha o ID do usuário e o ID da empresa");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("sdr_assignments" as any).insert({
      sdr_user_id: userId.trim(),
      organization_id: orgId.trim(),
      granted_by_owner_id: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("SDR vinculado à empresa. Agora configure os números liberados.");
    onCreated(userId.trim(), userId.trim());
    setUserId("");
    setOrgId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar SDR Multi-Empresa</DialogTitle>
          <DialogDescription>
            Informe o ID do usuário (auth.users.id) e o ID da empresa para criar o vínculo inicial.
            Depois você poderá adicionar mais empresas e selecionar os números liberados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>User ID do SDR</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="uuid do usuário"
            />
          </div>
          <div>
            <Label>Organization ID</Label>
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="uuid da empresa"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Vinculando..." : "Vincular SDR à empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
