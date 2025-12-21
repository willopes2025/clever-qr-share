import { MessageCircle } from "lucide-react";

export const EmptyInbox = () => {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Selecione uma conversa
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Escolha uma conversa na lista ao lado para visualizar e responder mensagens.
        </p>
      </div>
    </div>
  );
};
