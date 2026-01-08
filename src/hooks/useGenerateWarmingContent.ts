import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useWarming } from "@/hooks/useWarming";

export function useGenerateWarmingContent() {
  const { createContent } = useWarming();

  const generateContent = useMutation({
    mutationFn: async ({ category, quantity }: { category: string; quantity: number }) => {
      const { data, error } = await supabase.functions.invoke('generate-warming-content', {
        body: { category, quantity }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data.messages as string[];
    },
    onError: (error: Error) => {
      console.error('Error generating content:', error);
      toast({
        title: "Erro ao gerar conteúdo",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const generateAndSave = useMutation({
    mutationFn: async ({ category, quantity }: { category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell'; quantity: number }) => {
      const messages = await generateContent.mutateAsync({ category, quantity });
      
      // Add each generated message to the database
      for (const message of messages) {
        await createContent.mutateAsync({
          contentType: 'text',
          content: message,
          category
        });
      }
      
      return messages;
    },
    onSuccess: (messages) => {
      toast({
        title: "Conteúdo gerado",
        description: `${messages.length} mensagens foram adicionadas ao seu banco de conteúdos.`
      });
    },
    onError: (error: Error) => {
      console.error('Error saving generated content:', error);
    }
  });

  return {
    generateContent,
    generateAndSave,
    isGenerating: generateContent.isPending || generateAndSave.isPending
  };
}
