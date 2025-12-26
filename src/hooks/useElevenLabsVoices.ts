import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: 'cloned' | 'premade' | 'professional' | 'generated';
  preview_url?: string;
  labels?: {
    accent?: string;
    gender?: string;
    age?: string;
    description?: string;
    use_case?: string;
  };
  description?: string;
}

export function useElevenLabsVoices() {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const { data: voices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-list-voices');
      
      if (error) {
        console.error('Error fetching voices:', error);
        throw error;
      }
      
      return data.voices as ElevenLabsVoice[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Separate voices by category
  const clonedVoices = voices.filter(v => v.category === 'cloned');
  const premadeVoices = voices.filter(v => v.category === 'premade' || v.category === 'professional');
  const generatedVoices = voices.filter(v => v.category === 'generated');

  const stopCurrentAudio = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      setAudioElement(null);
    }
    setPlayingVoiceId(null);
  }, [audioElement]);

  const playPreview = useCallback(async (voiceId: string, customText?: string) => {
    // Stop any currently playing audio
    stopCurrentAudio();

    if (!voiceId) {
      toast.error('Selecione uma voz primeiro');
      return;
    }

    setPlayingVoiceId(voiceId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-preview-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            voiceId, 
            text: customText 
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar preview');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      setAudioElement(audio);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingVoiceId(null);
        setAudioElement(null);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setPlayingVoiceId(null);
        setAudioElement(null);
        toast.error('Erro ao reproduzir áudio');
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing preview:', error);
      setPlayingVoiceId(null);
      toast.error('Erro ao testar voz');
    }
  }, [stopCurrentAudio]);

  return {
    voices,
    clonedVoices,
    premadeVoices,
    generatedVoices,
    isLoading,
    error,
    refetch,
    playPreview,
    stopCurrentAudio,
    playingVoiceId,
    isPlaying: playingVoiceId !== null,
  };
}
