import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: ReactNode;
  className?: string;
  label?: string;
}

export const FloatingActionButton = ({ 
  onClick, 
  icon, 
  className,
  label 
}: FloatingActionButtonProps) => {
  const handleClick = () => {
    // Trigger haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "fixed right-4 bottom-20 z-40",
        "flex items-center justify-center gap-2",
        "h-14 min-w-14 px-4 rounded-full",
        "bg-gradient-neon text-primary-foreground",
        "shadow-depth-lg",
        "active:shadow-depth transition-shadow",
        className
      )}
    >
      {icon || <Plus className="h-6 w-6" />}
      {label && <span className="font-medium text-sm pr-1">{label}</span>}
    </motion.button>
  );
};
