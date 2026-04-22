import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { AddSdrDialog } from "./sdr/AddSdrDialog";
import { SdrAccessDialog } from "./sdr/SdrAccessDialog";

interface SdrRow {
  sdr_user_id: string;
  email: string | null;
  full_name: string | null;
  assignments: {
    id: string;
    organization_id: string;
    organization_name: string | null;
    instance_count: number;
    meta_count: number;
  }[];
}

export const SdrManagement = () => {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<{ userId: string; email: string } | null>(null);

  const { data: sdrs = [], isLoading } = useQuery({
    queryKey: ["sdr-management-list"],
    queryFn: async (): Promise<SdrRow[]> => {
      const { data: assignments, error } = await supabase
        .from("sdr_assignments" as any)
        .select(`
          id, sdr_user_id, organization_id,
          organizations(id, name),
          sdr_instance_access(id),
          sdr_meta_number_access(id)
        `);
      if (error) throw error;

      const rows = (assignments as any[]) || [];
      const userIds = Array.from(new Set(rows.map((r) => r.sdr_user_id)));
      let profiles: Record<string, { full_name: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        (profs as any[])?.forEach((p) => (profiles[p.id] = { full_name: p.full_name }));
      }

      const map = new Map<string, SdrRow>();
      rows.forEach((r) => {
        if (!map.has(r.sdr_user_id)) {
          map.set(r.sdr_user_id, {
            sdr_user_id: r.sdr_user_id,
            email: null,
            full_name: profiles[r.sdr_user_id]?.full_name || null,
            assignments: [],
          });
        }
        map.get(r.sdr_user_id)!.assignments.push({
          id: r.id,
          organization_id: r.organization_id,
          organization_name: r.organizations?.name || null,
          instance_count: r.sdr_instance_access?.length || 0,
          meta_count: r.sdr_meta_number_access?.length || 0,
        });
      });
      return Array.from(map.values());
    },
  });

  const removeAccess = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("sdr_assignments" as any)
        .delete()
        .eq("sdr_user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso SDR removido");
      queryClient.invalidateQueries({ queryKey: ["sdr-management-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>SDRs Multi-Empresa</CardTitle>
          <CardDescription>
            Apenas você (dono do sistema) pode gerenciar SDRs com acesso a múltiplas empresas.
          </CardDescription>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Cadastrar SDR
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && sdrs.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum SDR cadastrado ainda.</p>
        )}
        {sdrs.map((sdr) => (
          <div key={sdr.sdr_user_id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{sdr.full_name || "SDR"}</p>
                <p className="text-xs text-muted-foreground font-mono">{sdr.sdr_user_id}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setAccessFor({ userId: sdr.sdr_user_id, email: sdr.full_name || "SDR" })
                  }
                >
                  <SettingsIcon className="h-4 w-4 mr-1" /> Editar acessos
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Remover todos os acessos SDR deste usuário?")) {
                      removeAccess.mutate(sdr.sdr_user_id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {sdr.assignments.map((a) => (
                <Badge key={a.id} variant="secondary">
                  {a.organization_name} · {a.instance_count} WhatsApp · {a.meta_count} Meta
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>

      <AddSdrDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(userId, label) => {
          setAddOpen(false);
          setAccessFor({ userId, email: label });
          queryClient.invalidateQueries({ queryKey: ["sdr-management-list"] });
        }}
      />

      {accessFor && (
        <SdrAccessDialog
          sdrUserId={accessFor.userId}
          sdrLabel={accessFor.email}
          open={!!accessFor}
          onOpenChange={(o) => !o && setAccessFor(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["sdr-management-list"] })}
        />
      )}
    </Card>
  );
};

export default SdrManagement;
