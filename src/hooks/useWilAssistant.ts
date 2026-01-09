import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface WilMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export const useWilAssistant = () => {
  const [messages, setMessages] = useState<WilMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load or create session
  useEffect(() => {
    const loadSession = async () => {
      if (!user?.id) return;

      try {
        // Try to get existing session
        const { data: existingSession, error } = await supabase
          .from("wil_chat_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (existingSession && !error) {
          setSessionId(existingSession.id);
          // Parse messages from JSONB
          const savedMessages = (existingSession.messages as unknown as WilMessage[]) || [];
          setMessages(savedMessages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        }
      } catch (err) {
        // No existing session, that's fine
        console.log("No existing Wil session found");
      }
    };

    loadSession();
  }, [user?.id]);

  // Save messages to session
  const saveMessages = useCallback(async (newMessages: WilMessage[]) => {
    if (!user?.id) return;

    const messagesJson = JSON.parse(JSON.stringify(newMessages));

    try {
      if (sessionId) {
        await supabase
          .from("wil_chat_sessions")
          .update({ 
            messages: messagesJson,
            updated_at: new Date().toISOString()
          })
          .eq("id", sessionId);
      } else {
        const { data: newSession } = await supabase
          .from("wil_chat_sessions")
          .insert({
            user_id: user.id,
            messages: messagesJson,
          })
          .select()
          .single();

        if (newSession) {
          setSessionId(newSession.id);
        }
      }
    } catch (err) {
      console.error("Error saving Wil session:", err);
    }
  }, [user?.id, sessionId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user?.id || !content.trim()) return;

    const userMessage: WilMessage = {
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => 
            i === prev.length - 1 
              ? { ...m, content: assistantContent } 
              : m
          );
        }
        return [...prev, { 
          role: "assistant" as const, 
          content: assistantContent, 
          timestamp: new Date() 
        }];
      });
    };

    try {
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wil-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: allMessages,
            userId: user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao conectar com o Wil");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const tokenContent = parsed.choices?.[0]?.delta?.content;
            if (tokenContent) updateAssistant(tokenContent);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save the complete conversation
      const finalMessages: WilMessage[] = [
        ...messages,
        userMessage,
        { role: "assistant", content: assistantContent, timestamp: new Date() }
      ];
      setMessages(finalMessages);
      saveMessages(finalMessages);

    } catch (error) {
      console.error("Wil error:", error);
      toast({
        title: "Erro ao conectar com Wil",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, messages, saveMessages, toast]);

  const clearHistory = useCallback(async () => {
    if (!user?.id) return;
    
    setMessages([]);
    
    if (sessionId) {
      await supabase
        .from("wil_chat_sessions")
        .delete()
        .eq("id", sessionId);
      setSessionId(null);
    }
  }, [user?.id, sessionId]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  };
};
