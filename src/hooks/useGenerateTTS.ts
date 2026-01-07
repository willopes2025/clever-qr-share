import { useState } from 'react';
import { toast } from 'sonner';

interface GenerateTTSResult {
  audioUrl: string;
  fileName: string;
}

export function useGenerateTTS() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAudio = async (text: string, voiceId: string): Promise<GenerateTTSResult | null> => {
    if (!text.trim()) {
      toast.error('O texto não pode estar vazio');
      return null;
    }

    if (!voiceId) {
      toast.error('Selecione uma voz');
      return null;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text,
            voiceId
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar áudio');
      }

      const data = await response.json();

      if (!data.success || !data.audioUrl) {
        throw new Error(data.error || 'Erro ao gerar áudio');
      }

      return {
        audioUrl: data.audioUrl,
        fileName: data.fileName || `audio-${Date.now()}.mp3`
      };
    } catch (error: any) {
      console.error('Error generating TTS:', error);
      toast.error(error.message || 'Erro ao gerar áudio');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateAudio, isGenerating };
}
