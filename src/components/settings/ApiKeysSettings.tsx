import { useState } from "react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { ReferenceIdsCard } from "./ReferenceIdsCard";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  KeyRound,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import { ApiKeyDisplayDialog } from "./ApiKeyDisplayDialog";
import { RevokeApiKeyDialog } from "./RevokeApiKeyDialog";
import { Skeleton } from "@/components/ui/skeleton";

export function ApiKeysSettings() {
  const {
    keys,
    isLoading,
    createKey,
    revokeKey,
    renameKey,
    deleteKey,
  } = useApiKeys();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDisplayDialog, setShowDisplayDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async (name: string, expiresAt: string | null) => {
    try {
      const result = await createKey.mutateAsync({ name, expires_at: expiresAt });
      setNewApiKey(result.key);
      setShowCreateDialog(false);
      setShowDisplayDialog(true);
      toast.success("API Key criada com sucesso!");
    } catch {
      toast.error("Erro ao criar API Key.");
    }
  };

  const handleRevoke = async () => {
    if (!selectedKey) return;
    try {
      await revokeKey.mutateAsync(selectedKey.id);
      toast.success("API Key revogada.");
    } catch {
      toast.error("Erro ao revogar API Key.");
    }
    setShowRevokeDialog(false);
    setSelectedKey(null);
  };

  const handleDelete = async (keyId: string) => {
    try {
      await deleteKey.mutateAsync(keyId);
      toast.success("API Key deletada.");
    } catch {
      toast.error("Erro ao deletar API Key.");
    }
  };

  const handleRename = async (keyId: string) => {
    if (!editName.trim()) return;
    try {
      await renameKey.mutateAsync({ keyId, name: editName.trim() });
      toast.success("API Key renomeada.");
      setEditingId(null);
      setEditName("");
    } catch {
      toast.error("Erro ao renomear API Key.");
    }
  };

  const handleCopyPrefix = (prefix: string) => {
    navigator.clipboard.writeText(prefix);
    toast.success("Prefixo copiado!");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Ativa
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Expirada
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            Revogada
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Gerencie suas chaves de acesso à API pública do WideZap.
          </CardDescription>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Criar API Key
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <KeyRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              Nenhuma API Key criada ainda.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira key
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prefixo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      {editingId === key.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="border rounded px-2 py-1 text-sm w-48"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(key.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRename(key.id)}
                          >
                            OK
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">{key.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {key.key_prefix}
                      </code>
                    </TableCell>
                    <TableCell>{statusBadge(key.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.createdFormatted}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.expires_at
                        ? new Date(key.expires_at).toLocaleDateString("pt-BR")
                        : "Sem expiração"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {key.lastUsedFormatted}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleCopyPrefix(key.key_prefix)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar prefixo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(key.id);
                              setEditName(key.name);
                            }}
                            disabled={key.status === "revoked"}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Renomear
                          </DropdownMenuItem>
                          {key.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedKey({ id: key.id, name: key.name });
                                setShowRevokeDialog(true);
                              }}
                              className="text-destructive"
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Revogar
                            </DropdownMenuItem>
                          )}
                          {key.status === "revoked" && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(key.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Deletar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CreateApiKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreate}
        isLoading={createKey.isPending}
      />

      <ApiKeyDisplayDialog
        open={showDisplayDialog}
        onOpenChange={setShowDisplayDialog}
        apiKey={newApiKey}
      />

      <RevokeApiKeyDialog
        open={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
        keyName={selectedKey?.name ?? ""}
        onConfirm={handleRevoke}
        isLoading={revokeKey.isPending}
      />

      <ReferenceIdsCard />
    </Card>
  );
}
