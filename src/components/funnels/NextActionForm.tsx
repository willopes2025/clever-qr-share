import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CalendarDays, Clock, User, FileText } from "lucide-react";

export interface NextActionData {
  title: string;
  task_type_id: string | null;
  due_date: string;
  due_time: string;
  assigned_to: string | null;
  description: string;
}

interface NextActionFormProps {
  value: NextActionData;
  onChange: (value: NextActionData) => void;
  required?: boolean;
}

export function NextActionForm({ value, onChange, required = true }: NextActionFormProps) {
  const { taskTypes } = useTaskTypes();
  const { members } = useTeamMembers();

  // Set default date to today if empty
  useEffect(() => {
    if (!value.due_date) {
      const today = new Date().toISOString().split("T")[0];
      onChange({ ...value, due_date: today });
    }
  }, []);

  const activeMembers = members?.filter((m) => m.status === "active" && m.user_id) || [];

  const handleChange = (field: keyof NextActionData, newValue: string | null) => {
    onChange({ ...value, [field]: newValue });
  };

  const isValid = value.title && value.due_date;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        Próxima Ação {required && <span className="text-destructive">*</span>}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="next-action-title" className="text-sm">
          Título da Ação {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="next-action-title"
          placeholder="Ex: Ligar para cliente, Enviar proposta..."
          value={value.title}
          onChange={(e) => handleChange("title", e.target.value)}
          required={required}
        />
      </div>

      {/* Task Type */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Tipo de Tarefa
        </Label>
        <Select
          value={value.task_type_id || "none"}
          onValueChange={(v) => handleChange("task_type_id", v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem tipo</SelectItem>
            {taskTypes?.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  {type.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="next-action-date" className="text-sm flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Data {required && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="next-action-date"
            type="date"
            value={value.due_date}
            onChange={(e) => handleChange("due_date", e.target.value)}
            required={required}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next-action-time" className="text-sm flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Hora
          </Label>
          <Input
            id="next-action-time"
            type="time"
            value={value.due_time}
            onChange={(e) => handleChange("due_time", e.target.value)}
          />
        </div>
      </div>

      {/* Assigned To */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-1">
          <User className="h-3 w-3" />
          Responsável
        </Label>
        <Select
          value={value.assigned_to || "none"}
          onValueChange={(v) => handleChange("assigned_to", v === "none" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem responsável</SelectItem>
            {activeMembers.map((member) => (
              <SelectItem key={member.id} value={member.user_id!}>
                {member.profile?.full_name || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="next-action-description" className="text-sm">
          Descrição
        </Label>
        <Textarea
          id="next-action-description"
          placeholder="Detalhes sobre a próxima ação..."
          value={value.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={2}
        />
      </div>

      {!isValid && required && (
        <p className="text-xs text-destructive">
          Preencha o título e a data da próxima ação
        </p>
      )}
    </div>
  );
}
