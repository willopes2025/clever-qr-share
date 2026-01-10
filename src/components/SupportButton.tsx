import { useState, useRef, useEffect } from "react";
import { HelpCircle, BookOpen, MessageCircle, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, useDragControls } from "framer-motion";

const supportOptions = [
  {
    icon: BookOpen,
    title: "Documentação",
    description: "Acesse nossa base de conhecimento",
    action: () => window.open("/ajuda", "_self"),
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    description: "Fale conosco pelo WhatsApp",
    action: () => window.open("https://wa.me/5527999400707", "_blank"),
  },
  {
    icon: Mail,
    title: "Email",
    description: "contato@wideic.com",
    action: () => window.open("mailto:contato@wideic.com", "_blank"),
  },
  {
    icon: Phone,
    title: "Telefone",
    description: "(27) 99940-0707",
    action: () => window.open("tel:+5527999400707", "_blank"),
  },
];

const STORAGE_KEY = "support-button-position";

export const SupportButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Load saved position from localStorage
  const [position, setPosition] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return { x: 0, y: 0 };
        }
      }
    }
    return { x: 0, y: 0 };
  });

  // Save position to localStorage when drag ends
  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    const newPosition = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y,
    };
    setPosition(newPosition);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition));
  };

  const handleClick = () => {
    if (!isDragging) {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Drag Constraints Container */}
      <div
        ref={constraintsRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 79 }}
      />

      {/* Floating Draggable Button */}
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={position}
        className="fixed bottom-6 right-6 pointer-events-auto"
        style={{ 
          zIndex: 9999,
          x: position.x,
          y: position.y,
        }}
      >
        <Button
          onClick={handleClick}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-grab active:cursor-grabbing"
          size="icon"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </motion.div>

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
