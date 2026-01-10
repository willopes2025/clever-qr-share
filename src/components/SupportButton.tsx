import { useState } from "react";
import { HelpCircle, BookOpen, MessageCircle, Mail, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const supportOptions = [
  {
    icon: BookOpen,
    title: "Documentação",
    description: "Acesse nossa base de conhecimento",
    action: () => window.open("https://docs.example.com", "_blank"),
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    description: "Fale conosco pelo WhatsApp",
    action: () => window.open("https://wa.me/5511999999999", "_blank"),
  },
  {
    icon: Mail,
    title: "Email",
    description: "suporte@exemplo.com",
    action: () => window.open("mailto:suporte@exemplo.com", "_blank"),
  },
  {
    icon: Phone,
    title: "Telefone",
    description: "(11) 9999-9999",
    action: () => window.open("tel:+5511999999999", "_blank"),
  },
];

export const SupportButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        size="icon"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      {/* Support Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Suporte
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Como podemos ajudar?
            </p>

            {supportOptions.map((option) => (
              <button
                key={option.title}
                onClick={() => {
                  option.action();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent hover:border-primary/20 transition-colors text-left"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <option.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{option.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
