import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, RotateCcw, Bot, User, Beaker, Clock, Calendar, CalendarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AIAgentTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

interface TestMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  responseTime?: number;
}

interface CalendlyDebug {
  connected: boolean;
  prefetched: boolean;
  slotsCount: number;
  slot1: string | null;
  slot2: string | null;
}

export const AIAgentTestDialog = ({
  open,
  onOpenChange,
  agentId,
  agentName,
}: AIAgentTestDialogProps) => {
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [calendlyStatus, setCalendlyStatus] = useState<CalendlyDebug | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset messages when dialog opens
  useEffect(() => {
    if (open) {
      setMessages([
        {
          id: "system-1",
          role: "system",
          content: `Simulação iniciada com o agente "${agentName}". Digite uma mensagem para testar.`,
          timestamp: new Date(),
        },
      ]);
      setInputMessage("");
      setCalendlyStatus(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, agentName]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: TestMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const { data, error } = await supabase.functions.invoke("test-ai-agent", {
        body: {
          agentId,
          userMessage: userMessage.content,
          conversationHistory,
        },
      });

      if (error) throw error;

      const responseTime = Date.now() - startTime;

      // Update Calendly status from response
      if (data?.calendlyDebug) {
        setCalendlyStatus(data.calendlyDebug);
      } else if (data?.hasCalendarIntegration !== undefined) {
        setCalendlyStatus({
          connected: data.hasCalendarIntegration,
          prefetched: false,
          slotsCount: 0,
          slot1: null,
          slot2: null,
        });
      }

      if (data?.response) {
        const assistantMessage: TestMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          responseTime,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error testing agent:", error);
      toast.error("Erro ao testar agente: " + error.message);
      
      const errorMessage: TestMessage = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `Erro: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: "system-1",
        role: "system",
        content: `Conversa reiniciada. Digite uma mensagem para testar o agente "${agentName}".`,
        timestamp: new Date(),
      },
    ]);
    setInputMessage("");
    setCalendlyStatus(null);
    inputRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              Testar Agente: {agentName}
            </DialogTitle>
            
            {/* Calendly Status Badge */}
            {calendlyStatus && (
              <div className="flex items-center gap-2">
                {calendlyStatus.connected ? (
                  <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-300 bg-green-50">
                    <Calendar className="h-3 w-3" />
                    Calendly
                    {calendlyStatus.prefetched && calendlyStatus.slotsCount > 0 && (
                      <span className="ml-1 text-xs">({calendlyStatus.slotsCount} slots)</span>
                    )}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                    <CalendarOff className="h-3 w-3" />
                    Sem agenda
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "justify-end"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === "user" && "bg-primary text-primary-foreground",
                    message.role === "assistant" && "bg-muted",
                    message.role === "system" && "bg-muted/50 text-muted-foreground text-sm italic w-full max-w-full text-center"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.responseTime && (
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-60">
                      <Clock className="h-3 w-3" />
                      {(message.responseTime / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Digitando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-6 py-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              title="Reiniciar conversa"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Input
              ref={inputRef}
              placeholder="Digite sua mensagem de teste..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
