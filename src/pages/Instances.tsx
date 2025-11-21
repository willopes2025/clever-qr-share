import { DashboardSidebar } from "@/components/DashboardSidebar";
import { InstanceCard } from "@/components/InstanceCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Instance {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "connecting";
}

const Instances = () => {
  const [instances, setInstances] = useState<Instance[]>([
    { id: "1", name: "Vendas Principal", status: "connected" },
    { id: "2", name: "Suporte", status: "connected" },
    { id: "3", name: "Marketing", status: "disconnected" },
  ]);

  const [newInstanceName, setNewInstanceName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  const handleCreateInstance = () => {
    if (!newInstanceName.trim()) {
      toast.error("Por favor, insira um nome para a instância");
      return;
    }

    const newInstance: Instance = {
      id: Date.now().toString(),
      name: newInstanceName,
      status: "disconnected",
    };

    setInstances([...instances, newInstance]);
    setNewInstanceName("");
    setDialogOpen(false);
    toast.success("Instância criada com sucesso!");
  };

  const handleDeleteInstance = (id: string) => {
    setInstances(instances.filter((instance) => instance.id !== id));
    toast.success("Instância removida");
  };

  const handleShowQRCode = (instance: Instance) => {
    setSelectedInstance(instance);
    setQrDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      
      <main className="ml-64 p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Instâncias</h1>
            <p className="text-muted-foreground">
              Gerencie suas conexões WhatsApp com QR Code ilimitado
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
                <DialogDescription>
                  Crie uma nova instância para conectar ao WhatsApp via QR Code.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Instância</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateInstance();
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleCreateInstance} className="flex-1">
                  Criar Instância
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance, index) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <InstanceCard
                name={instance.name}
                status={instance.status}
                onQRCode={() => handleShowQRCode(instance)}
                onDelete={() => handleDeleteInstance(instance.id)}
              />
            </motion.div>
          ))}
        </div>

        {instances.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              Nenhuma instância criada ainda.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Criar Primeira Instância
            </Button>
          </div>
        )}

        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar via QR Code</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp para conectar a instância "{selectedInstance?.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-8">
              <div className="bg-muted rounded-xl p-8 flex items-center justify-center">
                <div className="bg-background p-4 rounded-lg">
                  <div className="h-64 w-64 bg-gradient-to-br from-whatsapp to-whatsapp-dark rounded-lg flex items-center justify-center">
                    <p className="text-white text-center px-4">
                      QR Code seria exibido aqui<br/>
                      <span className="text-sm opacity-75">(integração com Evolution API)</span>
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Abra o WhatsApp no seu celular → Configurações → Aparelhos conectados → Conectar aparelho
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Instances;
