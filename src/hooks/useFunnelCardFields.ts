import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "funnel-card-fields:";

export const useFunnelCardFields = (funnelId: string | undefined) => {
  const key = funnelId ? `${STORAGE_PREFIX}${funnelId}` : null;
  const [fieldKeys, setFieldKeysState] = useState<string[]>([]);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setFieldKeysState(raw ? JSON.parse(raw) : []);
    } catch {
      setFieldKeysState([]);
    }
  }, [key]);

  const setFieldKeys = useCallback(
    (next: string[]) => {
      setFieldKeysState(next);
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    },
    [key]
  );

  return { fieldKeys, setFieldKeys };
};
