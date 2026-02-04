import { motion } from "framer-motion";
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Target,
  Plus,
  Send,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { MobileCard } from "@/mobile/components/MobileCard";
import { FloatingActionButton } from "@/mobile/components/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QuickStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: number;
  delay: number;
  onClick?: () => void;
}

const QuickStat = ({ icon: Icon, label, value, trend, delay, onClick }: QuickStatProps) => (
  <MobileCard delay={delay} onClick={onClick} className="flex-1 min-w-[45%]">
    <div className="flex items-start justify-between mb-2">
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      {trend !== undefined && trend !== 0 && (
        <div className={cn(
          "flex items-center gap-0.5 text-xs font-medium",
          trend > 0 ? "text-accent" : "text-destructive"
        )}>
          {trend > 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </MobileCard>
);

const QuickStatSkeleton = () => (
  <div className="flex-1 min-w-[45%] bg-card rounded-2xl p-4 shadow-depth">
    <div className="flex items-start justify-between mb-2">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-4 w-10" />
    </div>
    <Skeleton className="h-8 w-16 mb-1" />
    <Skeleton className="h-3 w-20" />
  </div>
);

interface QuickActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

const QuickAction = ({ icon: Icon, label, onClick, variant = "secondary" }: QuickActionProps) => (
  <Button
    onClick={onClick}
    variant={variant === "primary" ? "default" : "outline"}
    className={cn(
      "flex-1 h-12 gap-2 rounded-xl",
      variant === "primary" && "bg-gradient-neon hover:opacity-90"
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </Button>
);

export const MobileHome = () => {
  const navigate = useNavigate();
  const { metrics, isLoading } = useDashboardMetrics();

  return (
    <div className="p-4 space-y-4">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2"
      >
        <h1 className="text-xl font-bold text-foreground">Olá! 👋</h1>
        <p className="text-sm text-muted-foreground">
          Aqui está o resumo de hoje
        </p>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="flex flex-wrap gap-3">
        {isLoading ? (
          <>
            <QuickStatSkeleton />
            <QuickStatSkeleton />
            <QuickStatSkeleton />
            <QuickStatSkeleton />
          </>
        ) : (
          <>
            <QuickStat
              icon={Users}
              label="Contatos"
              value={metrics?.contacts?.total || 0}
              delay={0}
              onClick={() => navigate("/contacts")}
            />
            <QuickStat
              icon={MessageSquare}
              label="Enviadas"
              value={metrics?.messages?.sent || 0}
              delay={1}
              onClick={() => navigate("/inbox")}
            />
            <QuickStat
              icon={Target}
              label="Campanhas"
              value={metrics?.campaigns?.total || 0}
              delay={2}
              onClick={() => navigate("/campaigns")}
            />
            <QuickStat
              icon={TrendingUp}
              label="Taxa Entrega"
              value={`${Math.round(metrics?.deliveryRate || 0)}%`}
              delay={3}
              onClick={() => navigate("/funnels")}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <MobileCard delay={4} static className="space-y-3">
        <h2 className="font-semibold text-foreground">Ações Rápidas</h2>
        <div className="flex gap-3">
          <QuickAction
            icon={Plus}
            label="Novo Lead"
            onClick={() => navigate("/contacts?new=true")}
            variant="primary"
          />
          <QuickAction
            icon={Send}
            label="Campanha"
            onClick={() => navigate("/campaigns?new=true")}
          />
        </div>
      </MobileCard>

      {/* Recent Activity Preview */}
      <MobileCard delay={5} static>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Acesso Rápido</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1 rounded-xl"
            onClick={() => navigate("/inbox")}
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="text-xs">Inbox</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1 rounded-xl"
            onClick={() => navigate("/funnels")}
          >
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-xs">Funis</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1 rounded-xl"
            onClick={() => navigate("/ai-agents")}
          >
            <Target className="h-5 w-5 text-primary" />
            <span className="text-xs">Agentes IA</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-3 flex-col gap-1 rounded-xl"
            onClick={() => navigate("/automations")}
          >
            <Send className="h-5 w-5 text-primary" />
            <span className="text-xs">Automações</span>
          </Button>
        </div>
      </MobileCard>

      {/* FAB for quick message */}
      <FloatingActionButton
        onClick={() => navigate("/inbox?new=true")}
        label="Nova Conversa"
      />
    </div>
  );
};
