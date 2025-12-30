import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useFusionPBXConfig } from "./useFusionPBXConfig";
import { toast } from "sonner";

export type CallStatus = 
  | 'idle' 
  | 'connecting' 
  | 'ringing' 
  | 'in_progress' 
  | 'on_hold' 
  | 'transferring' 
  | 'ended' 
  | 'failed';

export type CallDirection = 'inbound' | 'outbound';

export interface ActiveCall {
  id: string;
  remoteNumber: string;
  remoteName?: string;
  direction: CallDirection;
  status: CallStatus;
  startTime?: Date;
  duration: number;
  isMuted: boolean;
  isOnHold: boolean;
  contactId?: string;
  conversationId?: string;
}

interface WebRTCConfig {
  extension: string;
  sipPassword: string;
  domain: string;
  wssUrl: string;
  displayName: string;
  callerId: string;
  callerIdName: string;
  stunServer: string;
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
}

export const useSoftphone = () => {
  const { user } = useAuth();
  const { activeExtension, isConfigured } = useFusionPBXConfig();
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [webrtcConfig, setWebrtcConfig] = useState<WebRTCConfig | null>(null);
  
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Buscar configuração WebRTC
  const fetchWebRTCConfig = useCallback(async () => {
    if (!user?.id || !activeExtension) return null;

    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-webrtc-config', {
        body: { extensionId: activeExtension.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.config as WebRTCConfig;
    } catch (error: any) {
      console.error('[SOFTPHONE] Error fetching WebRTC config:', error);
      return null;
    }
  }, [user?.id, activeExtension]);

  // Registrar no servidor SIP (simulado - precisa de biblioteca SIP.js)
  const register = useCallback(async () => {
    if (!isConfigured || isRegistering) return;

    setIsRegistering(true);
    try {
      const config = await fetchWebRTCConfig();
      if (!config) {
        throw new Error('Falha ao obter configuração WebRTC');
      }

      setWebrtcConfig(config);
      
      // Aqui seria a integração com SIP.js ou JsSIP
      // Por enquanto, simulamos o registro
      console.log('[SOFTPHONE] WebRTC config loaded:', config.extension);
      
      // Simular registro bem-sucedido
      setTimeout(() => {
        setIsRegistered(true);
        setIsRegistering(false);
        toast.success(`Ramal ${config.extension} registrado`);
      }, 1000);

    } catch (error: any) {
      console.error('[SOFTPHONE] Registration error:', error);
      toast.error(`Erro ao registrar: ${error.message}`);
      setIsRegistering(false);
    }
  }, [isConfigured, isRegistering, fetchWebRTCConfig]);

  // Desregistrar
  const unregister = useCallback(() => {
    setIsRegistered(false);
    setWebrtcConfig(null);
    toast.info('Ramal desconectado');
  }, []);

  // Fazer chamada
  const makeCall = useCallback(async (
    toNumber: string, 
    options?: { 
      contactId?: string; 
      conversationId?: string;
      contactName?: string;
    }
  ) => {
    if (!isRegistered || !user?.id) {
      toast.error('Softphone não registrado');
      return null;
    }

    try {
      // Criar registro da chamada no backend
      const { data, error } = await supabase.functions.invoke('fusionpbx-originate', {
        body: {
          toNumber,
          extensionId: activeExtension?.id,
          contactId: options?.contactId,
          conversationId: options?.conversationId,
          callType: 'webrtc'
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const newCall: ActiveCall = {
        id: data.callId,
        remoteNumber: toNumber,
        remoteName: options?.contactName,
        direction: 'outbound',
        status: 'connecting',
        duration: 0,
        isMuted: false,
        isOnHold: false,
        contactId: options?.contactId,
        conversationId: options?.conversationId,
      };

      setActiveCall(newCall);

      // Simular conexão (aqui entraria a lógica WebRTC real)
      setTimeout(() => {
        setActiveCall(prev => prev ? { ...prev, status: 'ringing' } : null);
      }, 500);

      setTimeout(() => {
        setActiveCall(prev => {
          if (prev) {
            startDurationTimer();
            return { ...prev, status: 'in_progress', startTime: new Date() };
          }
          return null;
        });
      }, 2000);

      return data.callId;

    } catch (error: any) {
      console.error('[SOFTPHONE] Make call error:', error);
      toast.error(`Erro ao fazer chamada: ${error.message}`);
      return null;
    }
  }, [isRegistered, user?.id, activeExtension]);

  // Atender chamada
  const answerCall = useCallback(() => {
    if (!incomingCall) return;

    setActiveCall({
      ...incomingCall,
      status: 'in_progress',
      startTime: new Date()
    });
    setIncomingCall(null);
    startDurationTimer();
    toast.success('Chamada atendida');
  }, [incomingCall]);

  // Rejeitar chamada
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    // Aqui enviaria o reject via WebRTC
    setIncomingCall(null);
    toast.info('Chamada rejeitada');
  }, [incomingCall]);

  // Encerrar chamada
  const hangup = useCallback(async () => {
    if (!activeCall) return;

    stopDurationTimer();

    // Atualizar status no banco
    try {
      await supabase
        .from('voip_calls')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: activeCall.duration
        })
        .eq('id', activeCall.id);
    } catch (error) {
      console.error('[SOFTPHONE] Error updating call status:', error);
    }

    setActiveCall(null);
    toast.info('Chamada encerrada');
  }, [activeCall]);

  // Mute/Unmute
  const toggleMute = useCallback(() => {
    if (!activeCall) return;

    setActiveCall(prev => {
      if (!prev) return null;
      const newMuted = !prev.isMuted;
      
      // Aqui mutaria o áudio local via WebRTC
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMuted;
        });
      }

      return { ...prev, isMuted: newMuted };
    });
  }, [activeCall]);

  // Hold/Unhold
  const toggleHold = useCallback(async () => {
    if (!activeCall) return;

    const newHoldState = !activeCall.isOnHold;
    
    setActiveCall(prev => prev ? { 
      ...prev, 
      isOnHold: newHoldState,
      status: newHoldState ? 'on_hold' : 'in_progress'
    } : null);

    toast.info(newHoldState ? 'Chamada em espera' : 'Chamada retomada');
  }, [activeCall]);

  // Transferir chamada
  const transferCall = useCallback(async (targetExtension: string, type: 'blind' | 'attended' = 'blind') => {
    if (!activeCall) return;

    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-transfer', {
        body: {
          callId: activeCall.id,
          targetExtension,
          transferType: type
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setActiveCall(prev => prev ? { ...prev, status: 'transferring' } : null);
      toast.success(`Transferindo para ${targetExtension}`);

      // Após transferência bem-sucedida, encerrar
      setTimeout(() => {
        setActiveCall(null);
        stopDurationTimer();
      }, 1000);

    } catch (error: any) {
      console.error('[SOFTPHONE] Transfer error:', error);
      toast.error(`Erro na transferência: ${error.message}`);
    }
  }, [activeCall]);

  // Timer de duração
  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    durationIntervalRef.current = setInterval(() => {
      setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopDurationTimer();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopDurationTimer]);

  // Formatar duração
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    // Estado
    isConfigured,
    isRegistered,
    isRegistering,
    activeCall,
    incomingCall,
    webrtcConfig,
    
    // Ações de registro
    register,
    unregister,
    
    // Ações de chamada
    makeCall,
    answerCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleHold,
    transferCall,
    
    // Utilitários
    formatDuration,
  };
};
