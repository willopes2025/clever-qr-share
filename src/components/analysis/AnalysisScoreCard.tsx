import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface AnalysisScoreCardProps {
  title: string;
  score: number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function AnalysisScoreCard({ title, score, icon: Icon, description, className }: AnalysisScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 60) return 'bg-yellow-500/10';
    if (score >= 40) return 'bg-orange-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className={cn("bg-card border rounded-xl p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-lg", getScoreBg(score))}>
          <Icon className={cn("h-5 w-5", getScoreColor(score))} />
        </div>
        <div className={cn("text-3xl font-bold", getScoreColor(score))}>
          {score}
        </div>
      </div>
      <div>
        <h3 className="font-medium text-sm">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", getScoreBg(score).replace('/10', ''))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
