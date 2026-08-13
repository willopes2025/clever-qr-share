import { useCallback, useMemo, useState } from 'react';

export function useBulkSelection(visibleIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);

  const toggle = useCallback((id: string, checked?: boolean) => {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      const next = checked ?? !has;
      if (next && !has) return [...prev, id];
      if (!next && has) return prev.filter((i) => i !== id);
      return prev;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  const selectAll = useCallback(() => setSelectedIds(visibleIds), [visibleIds]);

  const visibleSelectedCount = visibleIds.filter((id) => selectedSet.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;

  const toggleAll = useCallback(() => {
    if (allVisibleSelected) {
      clear();
    } else {
      selectAll();
    }
  }, [allVisibleSelected, clear, selectAll]);

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    toggle,
    toggleAll,
    selectAll,
    clear,
    allVisibleSelected,
  };
}
