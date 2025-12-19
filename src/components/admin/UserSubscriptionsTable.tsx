import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit, History, UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

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

interface UserSubscriptionsTableProps {
  users: UserWithSubscription[];
  loading: boolean;
  onEditUser: (user: UserWithSubscription) => void;
  onViewHistory: (subscriptionId: string) => void;
}

const planColors: Record<string, string> = {
  free: "bg-gray-500/20 text-gray-400",
  starter: "bg-blue-500/20 text-blue-400",
  pro: "bg-purple-500/20 text-purple-400",
  business: "bg-yellow-500/20 text-yellow-400",
  none: "bg-red-500/20 text-red-400"
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-gray-500/20 text-gray-400",
  canceled: "bg-red-500/20 text-red-400",
  past_due: "bg-orange-500/20 text-orange-400"
};

export const UserSubscriptionsTable = ({
  users,
  loading,
  onEditUser,
  onViewHistory
}: UserSubscriptionsTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === "all" || (user.subscription?.plan || "none") === filterPlan;
    const matchesStatus = filterStatus === "all" || (user.subscription?.status || "none") === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Buscar por email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs bg-background/50"
        />
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[150px] bg-background/50">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="none">Sem plano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-background/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Email</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Instâncias</TableHead>
              <TableHead>Mensagens</TableHead>
              <TableHead>Válido até</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge className={planColors[user.subscription?.plan || "none"]}>
                      {user.subscription?.plan?.toUpperCase() || "SEM PLANO"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[user.subscription?.status || "inactive"]}>
                      {user.subscription?.status?.toUpperCase() || "INATIVO"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.subscription?.max_instances ?? "-"}
                  </TableCell>
                  <TableCell>
                    {user.subscription?.max_messages ?? "∞"}
                  </TableCell>
                  <TableCell>
                    {user.subscription?.current_period_end
                      ? format(new Date(user.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditUser(user)}
                        className="h-8 w-8 p-0"
                      >
                        {user.subscription ? (
                          <Edit className="h-4 w-4" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                      {user.subscription && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(user.subscription!.id)}
                          className="h-8 w-8 p-0"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Mostrando {filteredUsers.length} de {users.length} usuários
      </p>
    </div>
  );
};
