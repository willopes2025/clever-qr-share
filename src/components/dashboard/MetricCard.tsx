import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  color?: string;
  index?: number;
  isLoading?: boolean;
}

export const MetricCard = ({
  icon: Icon,
  label,
  value,
  change,
  color = "text-primary",
  index = 0,
  isLoading = false,
}: MetricCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className="p-6 glass-card hover:shadow-glow-cyan hover-glow transition-all duration-300 group neon-border">
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-neon flex items-center justify-center shadow-glow-cyan group-hover:shadow-glow-magenta transition-all">
            <Icon className="h-6 w-6 text-background" />
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          {isLoading ? (
            <div className="h-9 w-20 bg-muted/50 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-display font-bold mb-1 text-foreground group-hover:text-primary transition-colors">{value}</p>
          )}
          {change && (
            <p className="text-xs text-muted-foreground">{change}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
