import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { MobileHeader } from "@/mobile/components/MobileHeader";
import { MobileBottomNav } from "@/mobile/components/MobileBottomNav";
import { MobileSidebarDrawer } from "@/components/MobileSidebarDrawer";
import { ActivityTracker } from "@/components/productivity/ActivityTracker";
import { cn } from "@/lib/utils";

interface MobileAppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -8 }
};

const pageTransition = {
  type: "tween" as const,
  ease: [0.4, 0, 0.2, 1] as const,
  duration: 0.2
};

const MobileLayoutContent = ({ children, pageTitle, className }: MobileAppLayoutProps) => {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Activity Tracker - invisible, tracks user sessions */}
      <ActivityTracker />
      
      {/* Fixed Header */}
      <MobileHeader pageTitle={pageTitle} />
      
      {/* Mobile Sidebar Drawer */}
      <MobileSidebarDrawer />
      
      {/* Scrollable Content Area */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain",
            "pt-14 pb-20", // Header height + bottom nav + extra padding
            "mobile-scroll",
            className
          )}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      
      {/* Fixed Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export const MobileAppLayout = ({ children, pageTitle, className }: MobileAppLayoutProps) => {
  return (
    <SidebarProvider>
      <MobileLayoutContent pageTitle={pageTitle} className={className}>{children}</MobileLayoutContent>
    </SidebarProvider>
  );
};
