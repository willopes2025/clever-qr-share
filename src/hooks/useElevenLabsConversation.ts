import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseElevenLabsConversationOptions {
  agentId: string;
  contactName?: string;
  contactPhone?: string;
  conversationContext?: string;
  onTranscriptUpdate?: (transcript: string) => void;
  onStatusChange?: (status: string) => void;
}

export function useElevenLabsConversation({
  agentId,
  contactName,
  contactPhone,
  conversationContext,
  onTranscriptUpdate,
  onStatusChange,
}: UseElevenLabsConversationOptions) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<string>("");

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages(prev => {
      const newMessages = [...prev, { role, content, timestamp: new Date() }];
      // Update transcript
      const transcript = newMessages
        .map(m => `${m.role === "user" ? "Cliente" : "IA"}: ${m.content}`)
        .join("\n");
      transcriptRef.current = transcript;
      onTranscriptUpdate?.(transcript);
      return newMessages;
    });
  }, [onTranscriptUpdate]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      onStatusChange?.("connected");
      toast.success("Conectado ao agente de IA");
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      onStatusChange?.("disconnected");
    },
    onMessage: (payload) => {
      console.log("Message from ElevenLabs:", payload);
      
      // MessagePayload has: message, source ("user" | "ai"), role ("user" | "agent")
      const role = payload.role === "user" ? "user" : "assistant";
      addMessage(role, payload.message);
    },
    onError: (errorMessage) => {
      console.error("ElevenLabs conversation error:", errorMessage);
      setError(errorMessage || "Erro na conversa");
      toast.error("Erro na conversa com IA");
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setMessages([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        {
          body: {
            agentId,
            contactName,
            contactPhone,
            conversationContext,
          },
        }
      );

      if (fnError || !data?.signedUrl) {
        throw new Error(fnError?.message || "Falha ao obter token de sessão");
      }

      console.log("Starting ElevenLabs conversation with signed URL");

      // Start the conversation with WebSocket
      await conversation.startSession({
        signedUrl: data.signedUrl,
      });

      onStatusChange?.("connected");
    } catch (err) {
      console.error("Failed to start conversation:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast.error(`Falha ao iniciar conversa: ${errorMessage}`);
      onStatusChange?.("error");
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, contactName, contactPhone, conversationContext, conversation, onStatusChange]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
    onStatusChange?.("disconnected");
  }, [conversation, onStatusChange]);

  const sendTextMessage = useCallback((text: string) => {
    if (conversation.status !== "connected") {
      toast.error("Conversa não está conectada");
      return;
    }

    // Send text message to the agent using the proper method
    conversation.sendUserMessage(text);
  }, [conversation]);

  return {
    // State
    isConnecting,
    isConnected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking,
    status: conversation.status,
    messages,
    transcript: transcriptRef.current,
    error,

    // Actions
    startConversation,
    endConversation,
    sendTextMessage,

    // Volume controls
    setVolume: conversation.setVolume,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
