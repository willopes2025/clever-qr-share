import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Bell, Save, Loader2, Info, MessageSquare, Target, CheckSquare, Settings, TestTube, Clock, Calendar } from 'lucide-react';
import { useNotificationPreferences, NOTIFICATION_TYPES, NotificationPreferences, WEEKDAYS } from '@/hooks/useNotificationPreferences';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';

const CATEGORY_CONFIG = {
  inbox: { label: 'Inbox', icon: MessageSquare, description: 'Notificações de mensagens e conversas' },
  deals: { label: 'Deals', icon: Target, description: 'Notificações de funil de vendas' },
  tasks: { label: 'Tarefas', icon: CheckSquare, description: 'Notificações de tarefas' },
  other: { label: 'Outros', icon: Settings, description: 'Outras notificações' },
};

export function NotificationSettings() {
  const { preferences, isLoading, savePreferences, isSaving } = useNotificationPreferences();
  const { user } = useAuth();
  
  const [notificationSettings, setNotificationSettings] = useState<Partial<NotificationPreferences>>({
    notify_new_message: false,
    notify_new_deal: false,
    notify_deal_stage_change: false,
    notify_deal_assigned: true,
    notify_task_due: true,
    notify_task_assigned: true,
    notify_task_created: false,
    notify_task_updated: false,
    notify_task_deleted: false,
    notify_calendly_event: true,
    notify_ai_handoff: true,
    notify_campaign_complete: false,
    notify_instance_disconnect: true,
    notify_internal_chat: true,
    only_if_responsible: true,
    schedule_enabled: false,
    schedule_days: [1, 2, 3, 4, 5],
    schedule_start_time: '08:00',
    schedule_end_time: '18:00',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [teamMemberPhone, setTeamMemberPhone] = useState<string | null>(null);

  // Load team member phone
  useEffect(() => {
    if (user?.id) {
      supabase
        .from('team_members')
        .select('phone')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
        .then(({ data }) => {
          setTeamMemberPhone(data?.phone || null);
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (preferences) {
      setNotificationSettings({
        notify_new_message: preferences.notify_new_message,
        notify_new_deal: preferences.notify_new_deal,
        notify_deal_stage_change: preferences.notify_deal_stage_change,
        notify_deal_assigned: preferences.notify_deal_assigned,
        notify_task_due: preferences.notify_task_due,
        notify_task_assigned: preferences.notify_task_assigned,
        notify_task_created: preferences.notify_task_created,
        notify_task_updated: preferences.notify_task_updated,
        notify_task_deleted: preferences.notify_task_deleted,
        notify_calendly_event: preferences.notify_calendly_event,
        notify_ai_handoff: preferences.notify_ai_handoff,
        notify_campaign_complete: preferences.notify_campaign_complete,
        notify_instance_disconnect: preferences.notify_instance_disconnect,
        notify_internal_chat: preferences.notify_internal_chat ?? true,
        only_if_responsible: preferences.only_if_responsible,
        schedule_enabled: preferences.schedule_enabled ?? false,
        schedule_days: preferences.schedule_days ?? [1, 2, 3, 4, 5],
        schedule_start_time: preferences.schedule_start_time ?? '08:00',
        schedule_end_time: preferences.schedule_end_time ?? '18:00',
      });
    }
  }, [preferences]);

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDayToggle = (day: number) => {
    setNotificationSettings(prev => {
      const currentDays = prev.schedule_days || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      return { ...prev, schedule_days: newDays };
    });
  };

  const handleTimeChange = (field: 'schedule_start_time' | 'schedule_end_time', value: string) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    await savePreferences(notificationSettings);
  };

  const handleTestNotification = async () => {
    if (!teamMemberPhone) {
      toast.error('Você não tem telefone cadastrado. Peça ao administrador para configurar.');
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          type: 'test',
          data: {},
          recipientUserId: user?.id,
        },
      });

      if (error) throw error;
      
      if (data?.sent > 0) {
        toast.success('Notificação de teste enviada! Verifique seu WhatsApp.');
      } else {
        const errorDetails = data?.details?.errors?.join(', ') || 'Verifique se a organização tem uma instância de notificação configurada.';
        toast.error(`Não foi possível enviar: ${errorDetails}`);
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      toast.error('Erro ao enviar notificação de teste');
    } finally {
      setIsTesting(false);
    }
  };

  // Group notification types by category
  const groupedNotifications = NOTIFICATION_TYPES.reduce((acc, type) => {
    const category = type.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(type);
    return acc;
  }, {} as Record<string, typeof NOTIFICATION_TYPES[number][]>);

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notificações WhatsApp
          </CardTitle>
          <CardDescription>
            Configure quais notificações você deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              As notificações serão enviadas para o telefone cadastrado na sua conta de membro
              {teamMemberPhone ? (
                <span className="font-medium">: {teamMemberPhone}</span>
              ) : (
                <span className="text-muted-foreground"> (não configurado - peça ao administrador)</span>
              )}
              . A instância de envio é configurada pelo administrador na aba Equipe.
            </AlertDescription>
          </Alert>

          <div className="pt-2">
            <Button 
              variant="outline" 
              onClick={handleTestNotification} 
              disabled={isTesting || !teamMemberPhone}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Testar Notificação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Settings */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Janela de Horário
          </CardTitle>
          <CardDescription>
            Configure dias e horários para receber notificações. Fora desse período, as notificações serão acumuladas e enviadas em um resumo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="schedule_enabled" className="font-medium cursor-pointer">
                Ativar janela de horário
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, notificações fora do horário serão agrupadas e enviadas no início do próximo período autorizado.
              </p>
            </div>
            <Switch
              id="schedule_enabled"
              checked={notificationSettings.schedule_enabled}
              onCheckedChange={(checked) => handleToggle('schedule_enabled', checked)}
            />
          </div>

          {notificationSettings.schedule_enabled && (
            <>
              {/* Days Selection */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Dias da semana
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={notificationSettings.schedule_days?.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {day.short}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule_start_time">Início</Label>
                  <Input
                    id="schedule_start_time"
                    type="time"
                    value={notificationSettings.schedule_start_time}
                    onChange={(e) => handleTimeChange('schedule_start_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule_end_time">Fim</Label>
                  <Input
                    id="schedule_end_time"
                    type="time"
                    value={notificationSettings.schedule_end_time}
                    onChange={(e) => handleTimeChange('schedule_end_time', e.target.value)}
                  />
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Notificações recebidas fora do horário configurado serão arquivadas. No início do próximo período autorizado, você receberá uma única mensagem resumindo todas as notificações pendentes.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Types by Category */}
      {Object.entries(groupedNotifications).map(([category, types]) => {
        const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
        const Icon = config?.icon || Bell;
        
        return (
          <Card key={category} className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {config?.label || category}
              </CardTitle>
              <CardDescription>
                {config?.description || 'Notificações'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {types.map((type) => (
                <div key={type.key} className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor={type.key} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                  <Switch
                    id={type.key}
                    checked={notificationSettings[type.key as keyof NotificationPreferences] as boolean}
                    onCheckedChange={(checked) => handleToggle(type.key as keyof NotificationPreferences, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Responsibility Filter */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Filtro de Responsabilidade
          </CardTitle>
          <CardDescription>
            Controle quando receber notificações baseado na sua responsabilidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="only_if_responsible" className="font-medium cursor-pointer">
                Notificar apenas se eu for responsável
              </Label>
              <p className="text-xs text-muted-foreground">
                Notificações de tarefas serão enviadas apenas quando você for o responsável (assigned_to). 
                Notificações de deals serão enviadas quando você for o responsável pelo deal.
              </p>
            </div>
            <Switch
              id="only_if_responsible"
              checked={notificationSettings.only_if_responsible}
              onCheckedChange={(checked) => handleToggle('only_if_responsible', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Preferências
        </Button>
      </div>
    </div>
  );
}
