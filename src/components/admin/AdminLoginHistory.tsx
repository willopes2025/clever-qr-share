import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogIn, RefreshCw, Search } from "lucide-react";
import { formatDateTimeFull } from "@/lib/date-utils";
import { toast } from "sonner";

interface LoginEntry {
  event_time: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  ip_address: string | null;
  provider: string | null;
}

export const AdminLoginHistory = () => {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState("1");
  const [search, setSearch] = useState("");
  const [logins, setLogins] = useState<LoginEntry[]>([]);

  const fetchLogins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_login_history", { _days: Number(days) });
      if (error) throw error;
      setLogins((data as LoginEntry[]) ?? []);
    } catch (err) {
      console.error("[AdminLoginHistory] error:", err);
      toast.error("Erro ao carregar histórico de logins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logins;
    return logins.filter(
      (l) =>
        l.email?.toLowerCase().includes(q) ||
        l.full_name?.toLowerCase().includes(q) ||
        l.ip_address?.toLowerCase().includes(q)
    );
  }, [logins, search]);

  const uniqueUsers = useMemo(
    () => new Set(logins.map((l) => l.email).filter(Boolean)).size,
    [logins]
  );

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              Histórico de Logins
            </CardTitle>
            <CardDescription>
              {logins.length} login(s) · {uniqueUsers} usuário(s) únicos no período
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar email, nome, IP..."
                className="pl-8 w-64"
              />
            </div>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="3">Últimos 3 dias</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchLogins} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum login encontrado no período
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l, idx) => (
                  <TableRow key={`${l.event_time}-${idx}`}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTimeFull(l.event_time)}
                    </TableCell>
                    <TableCell>{l.full_name || "—"}</TableCell>
                    <TableCell className="font-medium">{l.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {l.provider || "email"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {l.ip_address || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
