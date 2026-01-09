import { useState, useEffect, useCallback } from 'react';
import { fetchMunicipiosForMultipleUfs, searchMunicipiosInList } from '@/services/ibgeMunicipios';

interface UseIbgeMunicipiosResult {
  municipios: string[];
  isLoading: boolean;
  error: string | null;
  searchMunicipios: (term: string, limit?: number) => string[];
}

export const useIbgeMunicipios = (ufs: string[]): UseIbgeMunicipiosResult => {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ufs.length === 0) {
      setMunicipios([]);
      setError(null);
      return;
    }

    const loadMunicipios = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await fetchMunicipiosForMultipleUfs(ufs);
        setMunicipios(result);
      } catch (err) {
        setError('Erro ao carregar municípios');
        console.error('Error loading municipalities:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMunicipios();
  }, [ufs.join(',')]); // Re-fetch when UFs change

  const searchMunicipios = useCallback(
    (term: string, limit: number = 50) => {
      return searchMunicipiosInList(municipios, term, limit);
    },
    [municipios]
  );

  return {
    municipios,
    isLoading,
    error,
    searchMunicipios,
  };
};
