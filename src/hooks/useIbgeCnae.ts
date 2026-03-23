import { useState, useEffect, useCallback } from 'react';
import { fetchAllCnaes, searchCnaeDynamic, CnaeItem } from '@/services/ibgeCnae';

export const useIbgeCnae = () => {
  const [cnaes, setCnaes] = useState<CnaeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetchAllCnaes()
      .then(setCnaes)
      .finally(() => setIsLoading(false));
  }, []);

  const searchCnae = useCallback(
    (term: string, limit = 50) => searchCnaeDynamic(cnaes, term, limit),
    [cnaes]
  );

  return { cnaes, isLoading, searchCnae };
};
