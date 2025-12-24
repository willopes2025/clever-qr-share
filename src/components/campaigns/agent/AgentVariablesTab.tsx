import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Loader2, Lock, Variable, Copy, Check } from 'lucide-react';
import { AgentVariable, useVariableMutations } from '@/hooks/useAIAgentConfig';
import { toast } from 'sonner';

interface AgentVariablesTabProps {
  agentConfigId: string | null;
  variables: AgentVariable[];
  isLoading: boolean;
}

export const AgentVariablesTab = ({
  agentConfigId,
  variables,
  isLoading,
}: AgentVariablesTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [varKey, setVarKey] = useState('');
  const [varValue, setVarValue] = useState('');
  const [varDescription, setVarDescription] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { addVariable, deleteVariable } = useVariableMutations();

  const systemVariables = variables.filter(v => v.is_system);
  const customVariables = variables.filter(v => !v.is_system);

  const handleAddVariable = () => {
    if (!agentConfigId || !varKey.trim()) return;

    // Validate key format
    const cleanKey = varKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    addVariable.mutate({
      agentConfigId,
      key: cleanKey,
      value: varValue.trim(),
      description: varDescription.trim() || undefined,
    }, {
      onSuccess: () => {
        setVarKey('');
        setVarValue('');
        setVarDescription('');
        setDialogOpen(false);
      }
    });
  };

  const handleDelete = (variable: AgentVariable) => {
    if (variable.is_system) return;
    if (confirm('Tem certeza que deseja remover esta variável?')) {
      deleteVariable.mutate({
        id: variable.id,
        agentConfigId: variable.agent_config_id,
      });
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedKey(key);
    toast.success('Copiado para área de transferência');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!agentConfigId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Variable className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Salve a configuração do agente primeiro para gerenciar variáveis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Box */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Como usar variáveis</h4>
        <p className="text-sm text-muted-foreground mb-2">
          Use variáveis no prompt do agente para personalizar as respostas. 
          Insira <code className="bg-muted px-1 rounded">{'{{nome_variavel}}'}</code> onde quiser que o valor seja substituído.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Exemplo:</strong> "Olá {'{{nome_contato}}'}, nosso link é {'{{link_site}}'}"
        </p>
      </div>

      {/* System Variables */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Variáveis do Sistema</h4>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Preenchidas automaticamente durante as conversas
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {systemVariables.map((variable) => (
            <Card key={variable.id} className="bg-muted/30">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                      {`{{${variable.variable_key}}}`}
                    </code>
                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                  </div>
                  {variable.variable_description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {variable.variable_description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(variable.variable_key)}
                >
                  {copiedKey === variable.variable_key ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Variables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Variáveis Personalizadas</h4>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Nova Variável
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Variável</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome da Variável</Label>
                  <Input
                    value={varKey}
                    onChange={(e) => setVarKey(e.target.value)}
                    placeholder="Ex: link_site, preco_produto..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras minúsculas, números e underscore
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    value={varValue}
                    onChange={(e) => setVarValue(e.target.value)}
                    placeholder="Ex: https://meusite.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={varDescription}
                    onChange={(e) => setVarDescription(e.target.value)}
                    placeholder="Para que serve esta variável"
                  />
                </div>
                <Button 
                  onClick={handleAddVariable} 
                  disabled={!varKey.trim() || addVariable.isPending}
                  className="w-full"
                >
                  {addVariable.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : customVariables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Variable className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Nenhuma variável personalizada</p>
            <p className="text-sm">Crie variáveis para usar nos prompts do agente</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customVariables.map((variable) => (
              <Card key={variable.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {`{{${variable.variable_key}}}`}
                      </code>
                      {variable.variable_value && (
                        <span className="text-sm text-muted-foreground">
                          = {variable.variable_value.length > 30 
                            ? variable.variable_value.substring(0, 30) + '...' 
                            : variable.variable_value}
                        </span>
                      )}
                    </div>
                    {variable.variable_description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {variable.variable_description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(variable.variable_key)}
                    >
                      {copiedKey === variable.variable_key ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(variable)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
