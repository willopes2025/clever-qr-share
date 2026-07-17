import { RefObject, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T extends { id: string }> {
  items: T[];
  parentRef: RefObject<HTMLDivElement>;
  renderItem: (item: T) => ReactNode;
  estimateSize?: number;
  overscan?: number;
}

export function VirtualList<T extends { id: string }>({
  items,
  parentRef,
  renderItem,
  estimateSize = 108,
  overscan = 8,
}: VirtualListProps<T>) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      className="p-2 relative"
      style={{ height: virtualizer.getTotalSize(), width: "100%" }}
    >
      {virtualItems.map((v) => {
        const item = items[v.index];
        if (!item) return null;
        return (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${v.start}px)`,
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
