import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface ScrollToBottomButtonProps {
  show: boolean;
  onClick: () => void;
  newMessagesCount?: number;
}

export const ScrollToBottomButton = ({ 
  show, 
  onClick, 
  newMessagesCount = 0 
}: ScrollToBottomButtonProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-24 right-6 z-10"
        >
          <Button
            onClick={onClick}
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-card hover:bg-muted border border-border text-foreground"
          >
            <ChevronDown className="h-5 w-5" />
            {newMessagesCount > 0 && (
              <Badge 
                className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 bg-primary text-primary-foreground text-xs"
              >
                {newMessagesCount > 99 ? "99+" : newMessagesCount}
              </Badge>
            )}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
