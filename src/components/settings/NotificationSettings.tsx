import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Phone, Save, Loader2 } from 'lucide-react';
import { useNotificationPreferences, NOTIFICATION_TYPES, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useProfile } from '@/hooks/useProfile';
import { formatPhoneNumber } from '@/lib/phone-utils';
import { Separator } from '@/components/ui/separator';

export function NotificationSettings() {
  const { preferences, isLoading, savePreferences, isSaving } = useNotificationPreferences();
  const { instances } = useWhatsAppInstances();
  const { profile, updateProfile } = useProfile();
  
  const [phone, setPhone] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [notificationSettings, setNotificationSettings] = useState<Partial<NotificationPreferences>>({
    notify_new_message: false,
    notify_new_deal: false,
    notify_deal_stage_change: false,
    notify_deal_assigned: true,
    notify_task_due: true,
    notify_task_assigned: true,
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
        notify_calendly_event: preferences.notify_calendly_event,
        notify_ai_handoff: preferences.notify_ai_handoff,
        notify_campaign_complete: preferences.notify_campaign_complete,
        notify_instance_disconnect: preferences.notify_instance_disconnect,
        only_if_responsible: preferences.only_if_responsible,
        notification_instance_id: preferences.notification_instance_id,
      });
    }
  }, [preferences]);

  useEffect(() => {
    // Phone will be loaded from profile or team_member in the future
    // For now, initialize empty
  }, [profile]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    // Save notification preferences (phone is stored in notification_preferences via the hook)
    await savePreferences(notificationSettings);
  };

  const connectedInstances = instances?.filter(i => i.status === 'connected') || [];

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
      {/* Phone Number Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Telefone para Notificações
          </CardTitle>
          <CardDescription>
            Número do WhatsApp que receberá as notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notification-phone">Telefone</Label>
            <Input
              id="notification-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              Este número receberá as notificações via WhatsApp
            </p>
          </div>

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

      {/* Notification Types Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Tipos de Notificação
          </CardTitle>
          <CardDescription>
            Escolha quais notificações deseja receber via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_TYPES.map((type) => (
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

          <Separator className="my-4" />

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="only_if_responsible" className="font-medium cursor-pointer">
                Notificar apenas se eu for responsável
              </Label>
              <p className="text-xs text-muted-foreground">
                Receber notificações apenas para clientes e deals que eu sou responsável
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
