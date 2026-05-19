import { useEffect, useState } from "react";

// Tailwind default breakpoints
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

const getWidth = () => (typeof window === "undefined" ? 1280 : window.innerWidth);

/**
 * Returns the current active Tailwind breakpoint name and width.
 * Re-renders on window resize.
 */
export function useBreakpoint() {
  const [width, setWidth] = useState<number>(getWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isAtLeast = (bp: Breakpoint) => width >= BREAKPOINTS[bp];
  const isBelow = (bp: Breakpoint) => width < BREAKPOINTS[bp];

  let current: Breakpoint = "sm";
  if (width >= BREAKPOINTS["2xl"]) current = "2xl";
  else if (width >= BREAKPOINTS.xl) current = "xl";
  else if (width >= BREAKPOINTS.lg) current = "lg";
  else if (width >= BREAKPOINTS.md) current = "md";

  return { width, current, isAtLeast, isBelow };
}
