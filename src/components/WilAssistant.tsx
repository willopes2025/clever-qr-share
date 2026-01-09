import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useWilAssistant, WilMessage } from "@/hooks/useWilAssistant";

export const WilAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, clearHistory } = useWilAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        // Handle headers
        if (line.startsWith("# ")) {
          return <h3 key={i} className="font-bold text-base mt-2 mb-1">{line.slice(2)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h4 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(3)}</h4>;
        }
        // Handle list items
        if (line.match(/^\d+\.\s/)) {
          return <p key={i} className="ml-2">{line}</p>;
        }
        if (line.startsWith("- ")) {
          return <p key={i} className="ml-2">• {line.slice(2)}</p>;
        }
        // Regular paragraphs
        if (line.trim()) {
          return <p key={i}>{line}</p>;
        }
        return <br key={i} />;
      });
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full",
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
          "px-4 py-3 shadow-lg hover:shadow-xl transition-shadow",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isOpen && "hidden"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-medium">Wil</span>
      </motion.button>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]",
              "bg-card border rounded-xl shadow-2xl overflow-hidden",
              "flex flex-col"
            )}
            style={{ height: "min(600px, calc(100vh - 6rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Wil</h3>
                  <p className="text-xs text-muted-foreground">Seu assistente virtual</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Limpar histórico"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-medium text-foreground mb-2">Olá! 👋</h4>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    Eu sou o Wil, seu assistente pessoal. Posso te ajudar a usar o sistema, responder dúvidas e mostrar suas métricas.
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Experimente perguntar:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["Como criar uma campanha?", "Quantos contatos tenho?", "O que é warming?"].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <MessageBubble key={index} message={message} formatMessage={formatMessage} />
                  ))}
                  {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg rounded-tl-none px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface MessageBubbleProps {
  message: WilMessage;
  formatMessage: (content: string) => React.ReactNode[];
}

const MessageBubble = ({ message, formatMessage }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted text-foreground rounded-tl-none"
        )}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="space-y-1">{formatMessage(message.content)}</div>
        )}
      </div>
    </div>
  );
};
