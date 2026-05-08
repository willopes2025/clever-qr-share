import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Smartphone, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PERMISSIONS, PermissionKey, PermissionCategory,
  PERMISSION_CATEGORIES, getPermissionsByCategory, getDefaultPermissions,
} from '@/config/permissions';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useMetaWhatsAppNumbers } from '@/hooks/useMetaWhatsAppNumbers';
import { useTeamGroups, TeamGroup, TeamGroupInput } from '@/hooks/useTeamGroups';
import { useChannelAccessScope } from '@/hooks/useChannelAccessScope';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group?: TeamGroup | null;
}

const categoryOrder: PermissionCategory[] = [
  'dashboard', 'instances', 'warming', 'inbox', 'funnels', 'calendar',
  'analysis', 'contacts', 'leads', 'lists', 'templates',
  'campaigns', 'chatbots', 'forms', 'ai_agents', 'finances', 'ssotica',
  'settings', 'team', 'notifications',
];

export function TeamGroupFormDialog({ open, onOpenChange, group }: Props) {
  const isEdit = !!group;
  const { createGroup, updateGroup } = useTeamGroups();
  const { instances } = useWhatsAppInstances();
  const { metaNumbers } = useMetaWhatsAppNumbers();
  const { orgUserIds } = useChannelAccessScope();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
    {} as Record<PermissionKey, boolean>
  );
  const [openCategories, setOpenCategories] = useState<Set<PermissionCategory>>(new Set());
  const [instanceIds, setInstanceIds] = useState<string[]>([]);
  const [metaIds, setMetaIds] = useState<string[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
      const perms = {} as Record<PermissionKey, boolean>;
      PERMISSIONS.forEach((p) => {
        perms[p.key] = group.permissions?.[p.key] ?? false;
      });
      setPermissions(perms);
      setInstanceIds(group.instance_ids ?? []);
      setMetaIds(group.meta_number_ids ?? []);
    } else {
      setName('');
      setDescription('');
      setPermissions(getDefaultPermissions('member'));
      setInstanceIds([]);
      setMetaIds([]);
    }
    setOpenCategories(new Set());
  }, [open, group]);

  const orgIdSet = orgUserIds ? new Set(orgUserIds) : null;
  const availableInstances = (instances ?? []).filter(
    (i) => !i.is_notification_only && (!orgIdSet || (i.user_id && orgIdSet.has(i.user_id)))
  );
  const availableMeta = (metaNumbers ?? []).filter(
    (n) => n.is_active && (!orgIdSet || (n.user_id && orgIdSet.has(n.user_id)))
  );

  const togglePermission = (key: PermissionKey) =>
    setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const toggleCategoryOpen = (c: PermissionCategory) =>
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  const toggleAllInCategory = (c: PermissionCategory, enabled: boolean) => {
    const cats = getPermissionsByCategory()[c];
    setPermissions((prev) => {
      const next = { ...prev };
      cats.forEach((p) => (next[p.key] = enabled));
      return next;
    });
  };

  const permissionsByCategory = getPermissionsByCategory();
  const isPending = createGroup.isPending || updateGroup.isPending;

  const handleSave = async () => {
    if (!name.trim()) return;
    const input: TeamGroupInput = {
      name: name.trim(),
      description: description.trim() || null,
      permissions,
      instance_ids: instanceIds,
      meta_number_ids: metaIds,
    };
    if (isEdit && group) {
      await updateGroup.mutateAsync({ id: group.id, input });
    } else {
      await createGroup.mutateAsync(input);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
          <DialogDescription>
            Salve um pacote de permissões, instâncias e números Meta para anexar a membros depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tg-name">Nome *</Label>
              <Input id="tg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: SDR" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg-desc">Descrição</Label>
              <Input
                id="tg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <Tabs defaultValue="permissions" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="permissions">Permissões</TabsTrigger>
              <TabsTrigger value="instances">Instâncias ({instanceIds.length || 'todas'})</TabsTrigger>
              <TabsTrigger value="meta">Meta ({metaIds.length || 'todos'})</TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="flex-1 overflow-hidden mt-3">
              <ScrollArea className="h-[45vh] pr-2">
                <div className="space-y-2">
                  {categoryOrder.map((category) => {
                    const cats = permissionsByCategory[category];
                    if (!cats?.length) return null;
                    const enabled = cats.filter((p) => permissions[p.key]).length;
                    const total = cats.length;
                    const allEnabled = enabled === total;
                    const someEnabled = enabled > 0 && enabled < total;
                    const isOpen = openCategories.has(category);
                    return (
                      <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategoryOpen(category)}>
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted cursor-pointer">
                              <div className="flex items-center gap-2">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="font-medium text-sm">{PERMISSION_CATEGORIES[category]}</span>
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  allEnabled ? 'bg-primary/20 text-primary'
                                    : someEnabled ? 'bg-amber-500/20 text-amber-600'
                                    : 'bg-muted-foreground/20 text-muted-foreground'
                                )}>
                                  {enabled}/{total}
                                </span>
                              </div>
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => toggleAllInCategory(category, !allEnabled)}>
                                  {allEnabled ? 'Desmarcar' : 'Marcar todos'}
                                </Button>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-3 space-y-3 border-t">
                              {cats.map((p) => (
                                <div key={p.key} className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <Label htmlFor={`tg-${p.key}`} className="font-normal text-sm cursor-pointer">
                                      {p.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground">{p.description}</p>
                                  </div>
                                  <Switch id={`tg-${p.key}`} checked={!!permissions[p.key]}
                                    onCheckedChange={() => togglePermission(p.key)} />
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="instances" className="flex-1 overflow-hidden mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Vazio = sem restrição (membro acessa todas).
              </p>
              <ScrollArea className="h-[45vh] pr-2">
                <div className="space-y-2">
                  {availableInstances.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma instância disponível</p>
                  )}
                  {availableInstances.map((i) => {
                    const checked = instanceIds.includes(i.id);
                    return (
                      <label key={i.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setInstanceIds((prev) =>
                            v === true ? [...prev, i.id] : prev.filter((x) => x !== i.id)
                          );
                        }} />
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm flex-1">{i.instance_name}</span>
                        <Badge variant={i.status === 'connected' ? 'default' : 'secondary'}>
                          {i.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="meta" className="flex-1 overflow-hidden mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Vazio = sem restrição (membro acessa todos).
              </p>
              <ScrollArea className="h-[45vh] pr-2">
                <div className="space-y-2">
                  {availableMeta.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum número Meta disponível</p>
                  )}
                  {availableMeta.map((n) => {
                    const checked = metaIds.includes(n.id);
                    return (
                      <label key={n.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setMetaIds((prev) =>
                            v === true ? [...prev, n.id] : prev.filter((x) => x !== n.id)
                          );
                        }} />
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {n.display_name || n.phone_number || n.phone_number_id}
                          </p>
                          {n.phone_number && n.display_name && (
                            <p className="text-xs text-muted-foreground">{n.phone_number}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar equipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
