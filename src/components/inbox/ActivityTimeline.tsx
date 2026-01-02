import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  User, 
  Bot, 
  MessageSquare, 
  Edit, 
  ArrowRight, 
  Tag, 
  StickyNote, 
  CheckSquare,
  Plus,
  Loader2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContactActivityLog, ContactActivity } from "@/hooks/useContactActivityLog";
import { cn } from "@/lib/utils";

interface ActivityTimelineProps {
  contactId: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'message_sent':
    case 'message_received':
      return MessageSquare;
    case 'contact_created':
      return Plus;
    case 'contact_edited':
      return Edit;
    case 'deal_created':
    case 'deal_moved':
    case 'deal_closed':
      return ArrowRight;
    case 'tag_added':
    case 'tag_removed':
      return Tag;
    case 'note_added':
      return StickyNote;
    case 'task_created':
    case 'task_completed':
      return CheckSquare;
    default:
      return MessageSquare;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'message_sent':
      return 'bg-green-500/20 text-green-600 dark:text-green-400';
    case 'message_received':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    case 'contact_created':
      return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
    case 'contact_edited':
      return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    case 'deal_moved':
    case 'deal_created':
      return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    case 'deal_closed':
      return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    case 'tag_added':
    case 'tag_removed':
      return 'bg-pink-500/20 text-pink-600 dark:text-pink-400';
    case 'note_added':
      return 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400';
    case 'task_created':
      return 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400';
    case 'task_completed':
      return 'bg-teal-500/20 text-teal-600 dark:text-teal-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const ActivityItem = ({ activity }: { activity: ContactActivity }) => {
  const Icon = getActivityIcon(activity.activity_type);
  const colorClass = getActivityColor(activity.activity_type);
  
  const actorName = activity.ai_agent?.agent_name 
    ? `${activity.ai_agent.agent_name} (IA)`
    : activity.user?.full_name || 'Sistema';
  
  const isAI = !!activity.ai_agent_id;

  const getMetadataDetails = () => {
    if (!activity.metadata) return null;
    
    if (activity.activity_type === 'deal_moved') {
      const from = activity.metadata.from_stage_name;
      const to = activity.metadata.to_stage_name;
      if (from && to) {
        return (
          <span className="text-xs text-muted-foreground">
            {from} → {to}
          </span>
        );
      }
    }
    
    if (activity.activity_type === 'contact_edited') {
      const oldName = activity.metadata.old_name;
      const newName = activity.metadata.new_name;
      if (oldName !== newName && newName) {
        return (
          <span className="text-xs text-muted-foreground">
            Nome: {oldName || '(vazio)'} → {newName}
          </span>
        );
      }
    }

    if (activity.activity_type === 'note_added' && activity.metadata.note_preview) {
      return (
        <span className="text-xs text-muted-foreground line-clamp-1">
          "{activity.metadata.note_preview}"
        </span>
      );
    }

    return null;
  };

  return (
    <div className="flex gap-3 py-2.5 px-3 hover:bg-muted/30 transition-colors">
      <div className={cn("flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isAI ? (
            <Bot className="h-3 w-3 text-primary" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-foreground">
            {actorName}
          </span>
        </div>
        
        <p className="text-sm text-foreground/80 mt-0.5">
          {activity.description}
        </p>
        
        {getMetadataDetails()}
        
        <span className="text-[10px] text-muted-foreground mt-1 block">
          {format(new Date(activity.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
};

export const ActivityTimeline = ({ contactId }: ActivityTimelineProps) => {
  const { data: activities, isLoading } = useContactActivityLog(contactId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhuma atividade registrada ainda.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="divide-y divide-border/50">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </ScrollArea>
  );
};
