import { useRef, useState, useCallback } from "react";

const INTERACTIVE_SELECTORS = 'button, a, input, textarea, select, [role="button"], [draggable="true"]';

export function useGrabScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't grab when clicking interactive elements or draggable cards
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTORS)) return;

    setIsGrabbing(true);
    startX.current = e.pageX - (ref.current?.offsetLeft || 0);
    scrollLeft.current = ref.current?.scrollLeft || 0;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isGrabbing || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = x - startX.current;
    ref.current.scrollLeft = scrollLeft.current - walk;
  }, [isGrabbing]);

  const onMouseUp = useCallback(() => {
    setIsGrabbing(false);
  }, []);

  return {
    ref,
    isGrabbing,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
    },
  };
}
