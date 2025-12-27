import { useTaskTypes, TaskType } from "@/hooks/useTaskTypes";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Video, Eye, Phone, Mail, MessageCircle, MapPin, Tag, Check } from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, React.ReactNode> = {
  video: <Video className="h-4 w-4" />,
  eye: <Eye className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  mail: <Mail className="h-4 w-4" />,
  'message-circle': <MessageCircle className="h-4 w-4" />,
  'map-pin': <MapPin className="h-4 w-4" />,
};

interface TaskTypeSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  compact?: boolean;
}

export function TaskTypeSelector({ value, onChange, compact = false }: TaskTypeSelectorProps) {
  const { taskTypes, isLoading } = useTaskTypes();
  const [open, setOpen] = useState(false);

  const selectedType = taskTypes.find(t => t.id === value);

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || <Tag className="h-4 w-4" />;
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 border-dashed",
              selectedType && "border-solid"
            )}
            style={selectedType ? { 
              borderColor: selectedType.color,
              color: selectedType.color,
            } : undefined}
          >
            {selectedType ? (
              <>
                {getIcon(selectedType.icon)}
                <span className="hidden sm:inline">{selectedType.name}</span>
              </>
            ) : (
              <>
                <Tag className="h-4 w-4" />
                <span className="hidden sm:inline">Tipo</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          <div className="grid gap-0.5">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                !value && "bg-muted"
              )}
            >
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nenhum</span>
              {!value && <Check className="h-4 w-4 ml-auto" />}
            </button>
            {taskTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  onChange(type.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                  value === type.id && "bg-muted"
                )}
              >
                <span style={{ color: type.color }}>{getIcon(type.icon)}</span>
                <span>{type.name}</span>
                {value === type.id && <Check className="h-4 w-4 ml-auto" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {taskTypes.map((type) => (
        <Button
          key={type.id}
          variant={value === type.id ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-8 gap-1.5",
            value === type.id && "ring-2 ring-offset-2"
          )}
          style={value === type.id ? { 
            backgroundColor: type.color,
            borderColor: type.color,
          } : {
            borderColor: type.color,
            color: type.color,
          }}
          onClick={() => onChange(value === type.id ? null : type.id)}
        >
          {getIcon(type.icon)}
          <span>{type.name}</span>
        </Button>
      ))}
    </div>
  );
}
