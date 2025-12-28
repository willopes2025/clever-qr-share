import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Phone, Save, Loader2, Info, MessageSquare, Target, CheckSquare, Settings } from 'lucide-react';
import { useNotificationPreferences, NOTIFICATION_TYPES, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useProfile } from '@/hooks/useProfile';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CATEGORY_CONFIG = {
  inbox: { label: 'Inbox', icon: MessageSquare, description: 'Notificações de mensagens e conversas' },
  deals: { label: 'Deals', icon: Target, description: 'Notificações de funil de vendas' },
  tasks: { label: 'Tarefas', icon: CheckSquare, description: 'Notificações de tarefas' },
  other: { label: 'Outros', icon: Settings, description: 'Outras notificações' },
};

export function NotificationSettings() {
  const { preferences, isLoading, savePreferences, isSaving } = useNotificationPreferences();
  const { instances } = useWhatsAppInstances();
  const { profile } = useProfile();
  
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
    only_if_responsible: true,
    notification_instance_id: null,
  });

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
        only_if_responsible: preferences.only_if_responsible,
        notification_instance_id: preferences.notification_instance_id,
      });
    }
  }, [preferences]);

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    await savePreferences(notificationSettings);
  };

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

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
      {/* Phone Info Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Configuração de Envio
          </CardTitle>
          <CardDescription>
            Configure a instância para envio das notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              As notificações serão enviadas para o telefone cadastrado no seu perfil
              {profile?.phone ? (
                <span className="font-medium">: {profile.phone}</span>
              ) : (
                <span className="text-muted-foreground"> (não configurado - configure na aba Perfil)</span>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="notification-instance">Instância para envio</Label>
            <Select
              value={notificationSettings.notification_instance_id || 'none'}
              onValueChange={(value) => handleToggle('notification_instance_id' as any, value === 'none' ? null : value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma selecionada</SelectItem>
                {connectedInstances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Instância WhatsApp que será usada para enviar as notificações
            </p>
          </div>
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
