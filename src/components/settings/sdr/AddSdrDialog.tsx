import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (userId: string, label: string) => void;
}

interface FoundUser {
  user_id: string;
  email: string;
  full_name: string | null;
}

interface Org {
  id: string;
  name: string;
}

export const AddSdrDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setFoundUser(null);
      setOrgId("");
      return;
    }
    // load all organizations (system owner has full access)
    supabase
      .from("organizations")
      .select("id, name")
      .order("name")
      .then(({ data }) => setOrgs((data as Org[]) || []));
  }, [open]);

  const searchUser = async () => {
    if (!email.trim()) {
      toast.error("Informe o email");
      return;
    }
    setSearching(true);
    setFoundUser(null);
    try {
      const { data, error } = await supabase.functions.invoke("sdr-lookup-user", {
        body: { email: email.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setFoundUser(data as FoundUser);
      toast.success("Usuário encontrado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar usuário");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !foundUser || !orgId) {
      toast.error("Selecione uma empresa");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("sdr_assignments" as any).insert({
      sdr_user_id: foundUser.user_id,
      organization_id: orgId,
      granted_by_owner_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("SDR vinculado. Configure os números liberados.");
    onCreated(foundUser.user_id, foundUser.full_name || foundUser.email);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar SDR Multi-Empresa</DialogTitle>
          <DialogDescription>
            Busque o usuário por email e selecione a primeira empresa que ele atenderá.
            Depois você poderá adicionar outras empresas e escolher os números liberados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email do SDR</Label>
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                type="email"
                onKeyDown={(e) => e.key === "Enter" && searchUser()}
              />
              <Button onClick={searchUser} disabled={searching} variant="outline">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {foundUser && (
            <div className="rounded-md border p-3 bg-muted/40">
              <p className="text-sm font-medium">{foundUser.full_name || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">{foundUser.email}</p>
            </div>
          )}

          {foundUser && (
            <div>
              <Label>Empresa inicial</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !foundUser || !orgId}
            className="w-full"
          >
            {submitting ? "Vinculando..." : "Vincular SDR à empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
