import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, GripVertical, Trash2, Edit, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';

interface CollectedField {
  key: string;
  label: string;
  required?: boolean;
}

interface AgentStagesTabProps {
  agentConfigId: string | null;
}

const conditionTypes = [
  { value: 'always', label: 'Sempre avançar' },
  { value: 'field_filled', label: 'Campos preenchidos' },
  { value: 'keyword_match', label: 'Palavra-chave detectada' },
  { value: 'intent_detected', label: 'Intenção detectada (IA)' },
  { value: 'manual', label: 'Manual (operador)' },
];

export function AgentStagesTab({ agentConfigId }: AgentStagesTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    stage_name: '',
    stage_prompt: '',
    condition_type: 'field_filled',
    condition_value: '',
    collected_fields: [] as CollectedField[],
    is_final: false,
  });
  const [newField, setNewField] = useState({ key: '', label: '', required: true });

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['agent-stages', agentConfigId],
    queryFn: async () => {
      if (!agentConfigId) return [];
      const { data, error } = await supabase
        .from('ai_agent_stages')
        .select('*')
        .eq('agent_config_id', agentConfigId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!agentConfigId,
  });

  const parseCollectedFields = (fields: Json): CollectedField[] => {
    if (!Array.isArray(fields)) return [];
    return fields
      .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null && 'key' in f && 'label' in f)
      .map(f => ({ key: String(f.key), label: String(f.label), required: f.required !== false }));
  };

  const parseCondition = (condition: Json): { type?: string; value?: string } => {
    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      return condition as { type?: string; value?: string };
    }
    return {};
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ai_agent_stages')
        .insert({
          agent_config_id: agentConfigId!,
          user_id: session.session.user.id,
          stage_name: data.stage_name,
          stage_prompt: data.stage_prompt || null,
          order_index: stages.length,
          collected_fields: data.collected_fields as unknown as Json,
          completion_condition: (data.condition_value ? { value: data.condition_value } : {}) as Json,
          condition_type: data.condition_type,
          is_final: data.is_final,
          actions: [] as Json,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-stages', agentConfigId] });
      toast.success('Estágio criado com sucesso');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar estágio: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('ai_agent_stages')
        .update({
          stage_name: data.stage_name,
          stage_prompt: data.stage_prompt || null,
          collected_fields: data.collected_fields as unknown as Json,
          completion_condition: (data.condition_value ? { value: data.condition_value } : {}) as Json,
          condition_type: data.condition_type,
          is_final: data.is_final,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-stages', agentConfigId] });
      toast.success('Estágio atualizado');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar estágio: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agent_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-stages', agentConfigId] });
      toast.success('Estágio removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover estágio: ' + error.message);
    },
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingStageId(null);
    setFormData({
      stage_name: '',
      stage_prompt: '',
      condition_type: 'field_filled',
      condition_value: '',
      collected_fields: [],
      is_final: false,
    });
    setNewField({ key: '', label: '', required: true });
  };

  const openEditDialog = (stage: typeof stages[0]) => {
    setEditingStageId(stage.id);
    const condition = parseCondition(stage.completion_condition);
    setFormData({
      stage_name: stage.stage_name,
      stage_prompt: stage.stage_prompt || '',
      condition_type: stage.condition_type,
      condition_value: condition.value || '',
      collected_fields: parseCollectedFields(stage.collected_fields),
      is_final: stage.is_final || false,
    });
    setIsDialogOpen(true);
  };

  const handleAddField = () => {
    if (!newField.key || !newField.label) return;
    setFormData(prev => ({
      ...prev,
      collected_fields: [...prev.collected_fields, { ...newField }],
    }));
    setNewField({ key: '', label: '', required: true });
  };

  const handleRemoveField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      collected_fields: prev.collected_fields.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (!formData.stage_name.trim()) {
      toast.error('Nome do estágio é obrigatório');
      return;
    }

    if (editingStageId) {
      updateMutation.mutate({ id: editingStageId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!agentConfigId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Salve a configuração do agente primeiro para adicionar estágios.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Estágios de Conversa</h3>
          <p className="text-sm text-muted-foreground">
            Crie um fluxo de conversa guiado por estágios
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Estágio
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : stages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhum estágio configurado.</p>
            <p className="text-sm mt-1">
              Adicione estágios para criar um fluxo de conversa estruturado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <Card key={stage.id} className="relative">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {index + 1}. {stage.stage_name}
                      </CardTitle>
                      {stage.is_final && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Final
                        </Badge>
                      )}
                    </div>
                    {parseCollectedFields(stage.collected_fields).length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {parseCollectedFields(stage.collected_fields).map((field, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {field.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => openEditDialog(stage)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(stage.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {index < stages.length - 1 && (
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStageId ? 'Editar Estágio' : 'Novo Estágio'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Estágio *</Label>
              <Input
                value={formData.stage_name}
                onChange={(e) => setFormData(prev => ({ ...prev, stage_name: e.target.value }))}
                placeholder="Ex: Coleta de Nome"
              />
            </div>

            <div className="space-y-2">
              <Label>Instrução/Prompt do Estágio</Label>
              <Textarea
                value={formData.stage_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, stage_prompt: e.target.value }))}
                placeholder="Instrução específica para este estágio."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Campos a Coletar</Label>
              <div className="space-y-2">
                {formData.collected_fields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded">
                    <span className="text-sm flex-1">
                      <span className="font-mono text-xs text-muted-foreground">{`{{${field.key}}}`}</span>
                      {' '}{field.label}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveField(index)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newField.key}
                    onChange={(e) => setNewField(prev => ({ ...prev, key: e.target.value.replace(/\s/g, '_').toLowerCase() }))}
                    placeholder="Chave"
                    className="flex-1"
                  />
                  <Input
                    value={newField.label}
                    onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="Descrição"
                    className="flex-1"
                  />
                  <Button variant="secondary" size="icon" onClick={handleAddField} disabled={!newField.key || !newField.label}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condição para Avançar</Label>
              <Select value={formData.condition_type} onValueChange={(value) => setFormData(prev => ({ ...prev, condition_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {conditionTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_final"
                checked={formData.is_final}
                onChange={(e) => setFormData(prev => ({ ...prev, is_final: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="is_final" className="cursor-pointer">Estágio final</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingStageId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
