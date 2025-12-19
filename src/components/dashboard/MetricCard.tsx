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
      <Card className="p-6 depth-card hover:shadow-hover transition-all duration-300 group">
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          {isLoading ? (
            <div className="h-9 w-20 bg-muted animate-pulse rounded-lg" />
          ) : (
            <p className="text-3xl font-bold mb-1 text-foreground group-hover:text-primary transition-colors">{value}</p>
          )}
          {change && (
            <p className="text-xs text-muted-foreground">{change}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
