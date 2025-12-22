import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEY = "sidebar-collapsed";

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Keyboard shortcut: Ctrl/Cmd + B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggle = () => setIsCollapsed((prev) => !prev);
  const setCollapsed = (collapsed: boolean) => setIsCollapsed(collapsed);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, setCollapsed }}>
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
