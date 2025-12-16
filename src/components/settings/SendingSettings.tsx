import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Clock, MessageSquare, Calendar, Save } from "lucide-react";

const DAYS_OF_WEEK = [
  { id: 'mon', label: 'Seg' },
  { id: 'tue', label: 'Ter' },
  { id: 'wed', label: 'Qua' },
  { id: 'thu', label: 'Qui' },
  { id: 'fri', label: 'Sex' },
  { id: 'sat', label: 'Sáb' },
  { id: 'sun', label: 'Dom' },
];

const formatInterval = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}min`;
  return `${minutes}min ${remainingSeconds}s`;
};

export const SendingSettings = () => {
  const { settings, updateSettings, defaultSettings } = useUserSettings();
  
  const [intervalMin, setIntervalMin] = useState(defaultSettings.message_interval_min);
  const [intervalMax, setIntervalMax] = useState(defaultSettings.message_interval_max);
  const [dailyLimit, setDailyLimit] = useState(defaultSettings.daily_limit);
  const [startHour, setStartHour] = useState(defaultSettings.allowed_start_hour);
  const [endHour, setEndHour] = useState(defaultSettings.allowed_end_hour);
  const [allowedDays, setAllowedDays] = useState<string[]>(defaultSettings.allowed_days);

  useEffect(() => {
    if (settings) {
      setIntervalMin(settings.message_interval_min ?? defaultSettings.message_interval_min);
      setIntervalMax(settings.message_interval_max ?? defaultSettings.message_interval_max);
      setDailyLimit(settings.daily_limit ?? defaultSettings.daily_limit);
      setStartHour(settings.allowed_start_hour ?? defaultSettings.allowed_start_hour);
      setEndHour(settings.allowed_end_hour ?? defaultSettings.allowed_end_hour);
      setAllowedDays(settings.allowed_days ?? defaultSettings.allowed_days);
    }
  }, [settings, defaultSettings]);

  const handleDayToggle = (dayId: string) => {
    setAllowedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSave = () => {
    updateSettings.mutate({
      message_interval_min: intervalMin,
      message_interval_max: intervalMax,
      daily_limit: dailyLimit,
      allowed_start_hour: startHour,
      allowed_end_hour: endHour,
      allowed_days: allowedDays,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Intervalo entre Mensagens
          </CardTitle>
          <CardDescription>
            Define o tempo de espera (em segundos) entre cada mensagem enviada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Intervalo Mínimo: {formatInterval(intervalMin)}</Label>
              <Slider
                value={[intervalMin]}
                onValueChange={([value]) => setIntervalMin(value)}
                min={1}
                max={90}
                step={1}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Intervalo Máximo: {formatInterval(intervalMax)}</Label>
              <Slider
                value={[intervalMax]}
                onValueChange={([value]) => setIntervalMax(Math.max(value, intervalMin))}
                min={1}
                max={1200}
                step={1}
                className="mt-2"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              As mensagens serão enviadas com um intervalo aleatório entre {formatInterval(intervalMin)} e {formatInterval(intervalMax)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Limite Diário
          </CardTitle>
          <CardDescription>
            Número máximo de mensagens que podem ser enviadas por dia por instância
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)}
              min={1}
              max={10000}
              className="w-32"
            />
            <span className="text-muted-foreground">mensagens/dia</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horário de Envio
          </CardTitle>
          <CardDescription>
            Define o horário permitido para envio de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Das</Label>
              <Input
                type="number"
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value) || 0)}
                min={0}
                max={23}
                className="w-20"
              />
              <span>:00</span>
            </div>
            <div className="flex items-center gap-2">
              <Label>até</Label>
              <Input
                type="number"
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value) || 0)}
                min={0}
                max={23}
                className="w-20"
              />
              <span>:00</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dias Permitidos
          </CardTitle>
          <CardDescription>
            Selecione os dias da semana em que as mensagens podem ser enviadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.id} className="flex items-center space-x-2">
                <Checkbox
                  id={day.id}
                  checked={allowedDays.includes(day.id)}
                  onCheckedChange={() => handleDayToggle(day.id)}
                />
                <Label htmlFor={day.id} className="cursor-pointer">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={updateSettings.isPending}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {updateSettings.isPending ? "Salvando..." : "Salvar Configurações de Envio"}
      </Button>
    </div>
  );
};
