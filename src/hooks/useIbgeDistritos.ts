import { useState, useEffect, useCallback } from 'react';
import { fetchDistritosForMultipleUfs, searchDistritosInList } from '@/services/ibgeDistritos';

interface UseIbgeDistritosResult {
  distritos: string[];
  isLoading: boolean;
  error: string | null;
  searchDistritos: (term: string, limit?: number) => string[];
}

export const useIbgeDistritos = (ufs: string[]): UseIbgeDistritosResult => {
  const [distritos, setDistritos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ufs.length === 0) {
      setDistritos([]);
      setError(null);
      return;
    }

    const loadDistritos = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchDistritosForMultipleUfs(ufs);
        setDistritos(result);
      } catch (err) {
        setError('Erro ao carregar distritos');
        console.error('Error loading districts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDistritos();
  }, [ufs.join(',')]);

  const searchDistritos = useCallback(
    (term: string, limit: number = 50) => {
      return searchDistritosInList(distritos, term, limit);
    },
    [distritos]
  );

  return {
    distritos,
    isLoading,
    error,
    searchDistritos,
  };
};
