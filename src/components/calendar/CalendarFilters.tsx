import { useTaskTypes } from "@/hooks/useTaskTypes";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, Eye, Phone, Mail, MessageCircle, MapPin, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ReactNode> = {
  video: <Video className="h-4 w-4" />,
  eye: <Eye className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  'message-circle': <MessageCircle className="h-4 w-4" />,
  'map-pin': <MapPin className="h-4 w-4" />,
};

export interface CalendarFiltersState {
  taskTypes: string[];
  members: string[];
  showCompleted: boolean;
}

interface CalendarFiltersProps {
  filters: CalendarFiltersState;
  onFiltersChange: (filters: CalendarFiltersState) => void;
}

export function CalendarFilters({ filters, onFiltersChange }: CalendarFiltersProps) {
  const { user } = useAuth();
  const { taskTypes } = useTaskTypes();
  const { members } = useTeamMembers();

  const allMembers = [
    {
      id: user?.id || '',
      name: 'Eu',
      email: user?.email || '',
    },
    ...members
      .filter(m => m.user_id && m.user_id !== user?.id && m.status === 'active')
      .map(m => ({
        id: m.user_id!,
        name: m.email.split('@')[0],
        email: m.email,
      })),
  ];

  const toggleTaskType = (typeId: string) => {
    const newTypes = filters.taskTypes.includes(typeId)
      ? filters.taskTypes.filter(t => t !== typeId)
      : [...filters.taskTypes, typeId];
    onFiltersChange({ ...filters, taskTypes: newTypes });
  };

  const toggleMember = (memberId: string) => {
    const newMembers = filters.members.includes(memberId)
      ? filters.members.filter(m => m !== memberId)
      : [...filters.members, memberId];
    onFiltersChange({ ...filters, members: newMembers });
  };

  const toggleCompleted = () => {
    onFiltersChange({ ...filters, showCompleted: !filters.showCompleted });
  };

  return (
    <div className="w-64 border-l bg-card p-4 space-y-6 hidden lg:block">
      {/* Tipos de tarefa */}
      <div>
        <h3 className="font-medium mb-3">Tipos de tarefa</h3>
        <div className="space-y-2">
          {taskTypes.map((type) => (
            <div key={type.id} className="flex items-center gap-2">
              <Checkbox
                id={`type-${type.id}`}
                checked={filters.taskTypes.length === 0 || filters.taskTypes.includes(type.id)}
                onCheckedChange={() => toggleTaskType(type.id)}
              />
              <Label
                htmlFor={`type-${type.id}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span style={{ color: type.color }}>
                  {iconMap[type.icon] || <Tag className="h-4 w-4" />}
                </span>
                {type.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Membros */}
      <div>
        <h3 className="font-medium mb-3">Membros</h3>
        <div className="space-y-2">
          {allMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-2">
              <Checkbox
                id={`member-${member.id}`}
                checked={filters.members.length === 0 || filters.members.includes(member.id)}
                onCheckedChange={() => toggleMember(member.id)}
              />
              <Label
                htmlFor={`member-${member.id}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {member.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {member.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Mostrar concluídas */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-completed"
          checked={filters.showCompleted}
          onCheckedChange={toggleCompleted}
        />
        <Label htmlFor="show-completed" className="cursor-pointer">
          Mostrar concluídas
        </Label>
      </div>
    </div>
  );
}
