import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Plus, Pencil, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { useTeamGroups, TeamGroup } from '@/hooks/useTeamGroups';
import { TeamGroupFormDialog } from './TeamGroupFormDialog';

export function TeamGroupsManager() {
  const { groups, isLoading, deleteGroup, resyncMembers } = useTeamGroups();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamGroup | null>(null);
  const [toDelete, setToDelete] = useState<TeamGroup | null>(null);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (g: TeamGroup) => { setEditing(g); setFormOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipes (Perfis prontos)
          </CardTitle>
          <CardDescription>
            Crie equipes com permissões, instâncias e números Meta pré-configurados para anexar a membros rapidamente.
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Equipe
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma equipe criada ainda. Clique em "Nova Equipe" para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Instâncias</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {g.instance_ids?.length ? `${g.instance_ids.length} selecionada(s)` : 'Todas'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {g.meta_number_ids?.length ? `${g.meta_number_ids.length} selecionado(s)` : 'Todos'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{g.member_count ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(g)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Re-sincronizar membros"
                        disabled={resyncMembers.isPending || (g.member_count ?? 0) === 0}
                        onClick={() => resyncMembers.mutate(g.id)}
                      >
                        {resyncMembers.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setToDelete(g)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TeamGroupFormDialog open={formOpen} onOpenChange={setFormOpen} group={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os membros anexados a esta equipe ficarão sem equipe definida. As permissões/instâncias atuais deles
              não serão alteradas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) await deleteGroup.mutateAsync(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
