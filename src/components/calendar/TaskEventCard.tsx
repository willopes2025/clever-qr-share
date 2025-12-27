import { CalendarTask } from "@/hooks/useCalendarTasks";
import { cn } from "@/lib/utils";
import { Video, Eye, Phone, Mail, MessageCircle, MapPin, Tag, Check, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const iconMap: Record<string, React.ReactNode> = {
  video: <Video className="h-3 w-3" />,
  eye: <Eye className="h-3 w-3" />,
  phone: <Phone className="h-3 w-3" />,
  mail: <Mail className="h-3 w-3" />,
  'message-circle': <MessageCircle className="h-3 w-3" />,
  'map-pin': <MapPin className="h-3 w-3" />,
};

interface TaskEventCardProps {
  task: CalendarTask;
  compact?: boolean;
  onClick?: () => void;
}

export function TaskEventCard({ task, compact = false, onClick }: TaskEventCardProps) {
  const isCompleted = !!task.completed_at;
  const typeColor = task.task_type?.color || '#6B7280';
  const typeIcon = task.task_type?.icon ? iconMap[task.task_type.icon] : <Tag className="h-3 w-3" />;

  const formatTime = (time: string | null) => {
    if (!time) return null;
    return time.substring(0, 5);
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-colors hover:opacity-80",
          isCompleted && "line-through opacity-50"
        )}
        style={{ 
          backgroundColor: `${typeColor}20`,
          color: typeColor,
          borderLeft: `2px solid ${typeColor}`,
        }}
      >
        <span className="flex items-center gap-1">
          {typeIcon}
          <span className="truncate">{task.title}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all hover:shadow-md",
        isCompleted && "opacity-60"
      )}
      style={{ borderLeftColor: typeColor, borderLeftWidth: '3px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span 
              className="flex items-center justify-center h-5 w-5 rounded"
              style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
            >
              {typeIcon}
            </span>
            <span className={cn(
              "font-medium truncate",
              isCompleted && "line-through"
            )}>
              {task.title}
            </span>
            {isCompleted && (
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
          </div>

          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.due_time && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                {formatTime(task.due_time)}
              </Badge>
            )}

            {task.task_type && (
              <Badge 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: typeColor, color: typeColor }}
              >
                {task.task_type.name}
              </Badge>
            )}

            {(task.contact_name || task.deal_title) && (
              <Badge variant="secondary" className="text-xs">
                {task.contact_name || task.deal_title}
              </Badge>
            )}

            {task.sync_with_google && (
              <Badge variant="outline" className="text-xs gap-1">
                <RefreshCwIcon className="h-3 w-3" />
                Google
              </Badge>
            )}
          </div>
        </div>

        {task.assignee && (
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={task.assignee.avatar_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {task.assignee.full_name?.slice(0, 2).toUpperCase() || '??'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </button>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
