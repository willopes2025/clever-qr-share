import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsaas, AsaasCustomer } from "@/hooks/useAsaas";
import { useOrganization } from "@/hooks/useOrganization";
import { Plus, Search, Loader2, Trash2, Edit, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AsaasCustomerForm } from "./AsaasCustomerForm";
import { AsaasCustomerDetail } from "./AsaasCustomerDetail";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const AsaasCustomerList = () => {
  const { customers, isLoadingCustomers, deleteCustomer } = useAsaas();
  const { checkPermission } = useOrganization();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AsaasCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<AsaasCustomer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<AsaasCustomer | null>(null);

  const canCreate = checkPermission('create_customers_asaas');
  const canEdit = checkPermission('edit_customers_asaas');
  const canDelete = checkPermission('delete_customers_asaas');

  const filteredCustomers = customers.filter(customer => 
    customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.cpfCnpj?.includes(searchQuery)
  );

  const handleEdit = (customer: AsaasCustomer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deletingCustomer) {
      await deleteCustomer.mutateAsync(deletingCustomer.id);
      setDeletingCustomer(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCustomer(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Clientes</CardTitle>
        {canCreate && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou CPF/CNPJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoadingCustomers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingCustomer(customer)}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.cpfCnpj || '-'}</Badge>
                    </TableCell>
                    <TableCell>{customer.mobilePhone || customer.phone || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setViewingCustomer(customer); }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setDeletingCustomer(customer); }}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {showForm && (
        <AsaasCustomerForm
          customer={editingCustomer}
          onClose={handleFormClose}
        />
      )}

      {viewingCustomer && (
        <AsaasCustomerDetail
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
        />
      )}

      <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{deletingCustomer?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};