import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { User, Globe, Save } from "lucide-react";

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
];

export const ProfileSettings = () => {
  const { user } = useAuth();
  const { settings, updateSettings, defaultSettings } = useUserSettings();
  
  const [timezone, setTimezone] = useState(defaultSettings.timezone);
  const [emailNotifications, setEmailNotifications] = useState(defaultSettings.email_notifications);

  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone ?? defaultSettings.timezone);
      setEmailNotifications(settings.email_notifications ?? defaultSettings.email_notifications);
    }
  }, [settings, defaultSettings]);

  const handleSave = () => {
    updateSettings.mutate({
      timezone,
      email_notifications: emailNotifications,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações da Conta
          </CardTitle>
          <CardDescription>
            Visualize as informações básicas da sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              value={user?.email || ''} 
              disabled 
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              O email não pode ser alterado
            </p>
          </div>

          <div className="space-y-2">
            <Label>ID do Usuário</Label>
            <Input 
              value={user?.id || ''} 
              disabled 
              className="bg-muted font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Membro desde</Label>
            <Input 
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : ''} 
              disabled 
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regionalização
          </CardTitle>
          <CardDescription>
            Configure seu fuso horário para agendamentos corretos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Fuso Horário</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione seu fuso horário" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Usado para agendamento de campanhas e restrições de horário
            </p>
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        disabled={updateSettings.isPending}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {updateSettings.isPending ? "Salvando..." : "Salvar Configurações de Perfil"}
      </Button>
    </div>
  );
};
