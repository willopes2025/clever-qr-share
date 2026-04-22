import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  sdrUserId: string;
  sdrLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

interface Assignment {
  id: string;
  organization_id: string;
  organization_name: string;
  instances: { id: string; name: string; enabled: boolean }[];
  metaNumbers: { id: string; label: string; enabled: boolean }[];
}

export const SdrAccessDialog = ({ sdrUserId, sdrLabel, open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [newOrgId, setNewOrgId] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("sdr_assignments" as any)
      .select(`
        id, organization_id,
        organizations(id, name, owner_id),
        sdr_instance_access(instance_id),
        sdr_meta_number_access(meta_number_id)
      `)
      .eq("sdr_user_id", sdrUserId);

    const result: Assignment[] = [];
    for (const r of (rows as any[]) || []) {
      const ownerId = r.organizations?.owner_id;
      // load instances and meta numbers belonging to that organization (via owner)
      const { data: insts } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, user_id")
        .eq("user_id", ownerId);
      const { data: metas } = await supabase
        .from("meta_whatsapp_numbers")
        .select("id, display_phone_number, user_id")
        .eq("user_id", ownerId);

      const enabledInst = new Set((r.sdr_instance_access || []).map((x: any) => x.instance_id));
      const enabledMeta = new Set((r.sdr_meta_number_access || []).map((x: any) => x.meta_number_id));

      result.push({
        id: r.id,
        organization_id: r.organization_id,
        organization_name: r.organizations?.name || "Empresa",
        instances: ((insts as any[]) || []).map((i) => ({
          id: i.id,
          name: i.instance_name,
          enabled: enabledInst.has(i.id),
        })),
        metaNumbers: ((metas as any[]) || []).map((m) => ({
          id: m.id,
          label: m.display_phone_number || m.id,
          enabled: enabledMeta.has(m.id),
        })),
      });
    }
    setAssignments(result);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sdrUserId]);

  const toggleInstance = (assignmentIdx: number, instanceId: string) => {
    setAssignments((prev) => {
      const copy = [...prev];
      copy[assignmentIdx] = {
        ...copy[assignmentIdx],
        instances: copy[assignmentIdx].instances.map((i) =>
          i.id === instanceId ? { ...i, enabled: !i.enabled } : i
        ),
      };
      return copy;
    });
  };

  const toggleMeta = (assignmentIdx: number, metaId: string) => {
    setAssignments((prev) => {
      const copy = [...prev];
      copy[assignmentIdx] = {
        ...copy[assignmentIdx],
        metaNumbers: copy[assignmentIdx].metaNumbers.map((m) =>
          m.id === metaId ? { ...m, enabled: !m.enabled } : m
        ),
      };
      return copy;
    });
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm("Remover o vínculo desta empresa?")) return;
    const { error } = await supabase.from("sdr_assignments" as any).delete().eq("id", assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vínculo removido");
    load();
  };

  const addOrganization = async () => {
    if (!user || !newOrgId.trim()) return;
    const { error } = await supabase.from("sdr_assignments" as any).insert({
      sdr_user_id: sdrUserId,
      organization_id: newOrgId.trim(),
      granted_by_owner_id: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewOrgId("");
    toast.success("Empresa adicionada");
    load();
  };

  const save = async () => {
    setLoading(true);
    try {
      for (const a of assignments) {
        // Reset instance access
        await supabase.from("sdr_instance_access" as any).delete().eq("sdr_assignment_id", a.id);
        const enabledInsts = a.instances.filter((i) => i.enabled);
        if (enabledInsts.length) {
          await supabase.from("sdr_instance_access" as any).insert(
            enabledInsts.map((i) => ({ sdr_assignment_id: a.id, instance_id: i.id }))
          );
        }
        // Reset meta access
        await supabase.from("sdr_meta_number_access" as any).delete().eq("sdr_assignment_id", a.id);
        const enabledMetas = a.metaNumbers.filter((m) => m.enabled);
        if (enabledMetas.length) {
          await supabase.from("sdr_meta_number_access" as any).insert(
            enabledMetas.map((m) => ({ sdr_assignment_id: a.id, meta_number_id: m.id }))
          );
        }
      }
      toast.success("Acessos atualizados");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acessos do SDR</DialogTitle>
          <DialogDescription>
            Selecione quais instâncias do WhatsApp e números Meta {sdrLabel} pode usar em cada empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {assignments.map((a, idx) => (
            <div key={a.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{a.organization_name}</h4>
                <Button size="sm" variant="ghost" onClick={() => removeAssignment(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Instâncias WhatsApp ({a.instances.length})
                </p>
                {a.instances.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma instância nessa empresa.</p>
                )}
                <div className="space-y-1">
                  {a.instances.map((i) => (
                    <label key={i.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={i.enabled} onCheckedChange={() => toggleInstance(idx, i.id)} />
                      <span>{i.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Números Meta ({a.metaNumbers.length})
                </p>
                {a.metaNumbers.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum número Meta nessa empresa.</p>
                )}
                <div className="space-y-1">
                  {a.metaNumbers.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={m.enabled} onCheckedChange={() => toggleMeta(idx, m.id)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="border-t pt-3 space-y-2">
            <Label>Adicionar outra empresa (Organization ID)</Label>
            <div className="flex gap-2">
              <Input
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                placeholder="uuid da empresa"
              />
              <Button onClick={addOrganization} variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          <Button onClick={save} disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Salvar acessos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
