import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const MobileSearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Buscar...",
  className,
  autoFocus = false
}: MobileSearchBarProps) => {
  const handleClear = () => {
    onChange("");
    // Trigger haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <div className={cn("sticky top-0 z-10 bg-background/95 backdrop-blur-sm p-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-10 pr-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
        />
        <AnimatePresence>
          {value && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-9 w-9 rounded-lg hover:bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
