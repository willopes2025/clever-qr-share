import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ChatbotFlowList } from "@/components/chatbot-builder/ChatbotFlowList";
import { ChatbotFlowEditor } from "@/components/chatbot-builder/ChatbotFlowEditor";
import { ChatbotFlowFormDialog } from "@/components/chatbot-builder/ChatbotFlowFormDialog";
import { useChatbotFlows, ChatbotFlow } from "@/hooks/useChatbotFlows";
import { Button } from "@/components/ui/button";
import { Plus, Bot, ArrowLeft } from "lucide-react";

const Chatbots = () => {
  const { flows, isLoading } = useChatbotFlows();
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (selectedFlow) {
    return (
      <DashboardLayout>
        <div className="h-screen flex flex-col">
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFlow(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-semibold">{selectedFlow.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {selectedFlow.is_active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>
          </div>
          <ChatbotFlowEditor flow={selectedFlow} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Construtor de Chatbot</h1>
              <p className="text-muted-foreground">
                Crie fluxos de automação visuais sem código
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>

        <ChatbotFlowList
          flows={flows || []}
          isLoading={isLoading}
          onSelect={setSelectedFlow}
          onCreateNew={() => setShowCreateDialog(true)}
        />

        <ChatbotFlowFormDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </DashboardLayout>
  );
};

export default Chatbots;
