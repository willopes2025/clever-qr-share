import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BREAKPOINTS } from "@/hooks/useBreakpoint";

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = "sidebar-collapsed";
const USER_PREF_KEY = "sidebar-user-pref"; // tracks if user manually toggled

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const [userTouched, setUserTouched] = useState<boolean>(() => {
    return localStorage.getItem(USER_PREF_KEY) === "true";
  });
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
    // Default: auto-collapse on narrower desktops
    if (typeof window !== "undefined" && window.innerWidth < BREAKPOINTS.xl) return true;
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Auto-adapt to viewport unless the user has explicitly set a preference
  useEffect(() => {
    if (userTouched || isMobile) return;
    const apply = () => {
      const shouldCollapse = window.innerWidth < BREAKPOINTS.xl;
      setIsCollapsedState(shouldCollapse);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [userTouched, isMobile]);

  // Close mobile sidebar on route change or resize to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsMobileOpen(false);
    }
  }, [isMobile]);

  const markTouched = () => {
    if (!userTouched) {
      setUserTouched(true);
      localStorage.setItem(USER_PREF_KEY, "true");
    }
  };

  const setIsCollapsed: typeof setIsCollapsedState = (value) => {
    markTouched();
    setIsCollapsedState(value);
  };

  // Keyboard shortcut: Ctrl/Cmd + B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        if (isMobile) {
          setIsMobileOpen((prev) => !prev);
        } else {
          setIsCollapsed((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  const toggle = () => setIsCollapsed((prev) => !prev);
  const setCollapsed = (collapsed: boolean) => setIsCollapsed(collapsed);
  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);
  const toggleMobile = () => setIsMobileOpen((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed, 
      isMobileOpen,
      isMobile,
      toggle, 
      setCollapsed,
      openMobile,
      closeMobile,
      toggleMobile
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
};
