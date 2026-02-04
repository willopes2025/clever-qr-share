import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Animation delay for staggered lists */
  delay?: number;
  /** Disable touch animations */
  static?: boolean;
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: delay * 0.05,
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const
    }
  })
};

export const MobileCard = ({ 
  children, 
  className, 
  onClick, 
  delay = 0,
  static: isStatic = false 
}: MobileCardProps) => {
  const CardComponent = isStatic ? "div" : motion.div;

  const baseProps = {
    className: cn(
      "bg-card rounded-2xl p-4 shadow-depth",
      "active:shadow-none active:scale-[0.98] transition-all duration-150",
      onClick && "cursor-pointer",
      className
    ),
    onClick
  };

  if (isStatic) {
    return <div {...baseProps}>{children}</div>;
  }

  return (
    <motion.div
      {...baseProps}
      custom={delay}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {children}
    </motion.div>
  );
};
