import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte texto em CAPSLOCK para Primeira Maiúscula
 * Ex: "ÓTICA MARTINS" → "Ótica Martins"
 * Ex: "RUA DA CONSOLAÇÃO" → "Rua da Consolação"
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  
  // Lista de palavras que devem permanecer minúsculas (exceto se for a primeira palavra)
  const minorWords = ['da', 'de', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com'];
  
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      
      // Primeira palavra sempre com inicial maiúscula
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Palavras menores ficam minúsculas
      if (minorWords.includes(word)) {
        return word;
      }
      // Demais palavras com inicial maiúscula
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
