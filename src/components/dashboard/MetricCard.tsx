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
      <Card className="p-6 shadow-medium hover:shadow-large transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          {isLoading ? (
            <div className="h-9 w-20 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold mb-1">{value}</p>
          )}
          {change && (
            <p className="text-xs text-muted-foreground">{change}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
