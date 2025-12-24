import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileText, 
  Link as LinkIcon, 
  Upload, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Globe,
  File
} from 'lucide-react';
import { KnowledgeItem, useKnowledgeItemMutations } from '@/hooks/useAIAgentConfig';

interface AgentKnowledgeTabProps {
  agentConfigId: string | null;
  knowledgeItems: KnowledgeItem[];
  isLoading: boolean;
}

export const AgentKnowledgeTab = ({
  agentConfigId,
  knowledgeItems,
  isLoading,
}: AgentKnowledgeTabProps) => {
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addTextKnowledge, addUrlKnowledge, uploadPdfKnowledge, deleteKnowledge } = useKnowledgeItemMutations();

  const handleAddText = () => {
    if (!agentConfigId || !textTitle.trim() || !textContent.trim()) return;
    
    addTextKnowledge.mutate({
      agentConfigId,
      title: textTitle.trim(),
      content: textContent.trim(),
    }, {
      onSuccess: () => {
        setTextTitle('');
        setTextContent('');
        setTextDialogOpen(false);
      }
    });
  };

  const handleAddUrl = () => {
    if (!agentConfigId || !urlTitle.trim() || !urlValue.trim()) return;
    
    addUrlKnowledge.mutate({
      agentConfigId,
      title: urlTitle.trim(),
      url: urlValue.trim(),
    }, {
      onSuccess: () => {
        setUrlTitle('');
        setUrlValue('');
        setUrlDialogOpen(false);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agentConfigId) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Apenas arquivos PDF são aceitos');
      return;
    }

    uploadPdfKnowledge.mutate({ agentConfigId, file });
    e.target.value = '';
  };

  const handleDelete = (item: KnowledgeItem) => {
    if (confirm('Tem certeza que deseja remover este item?')) {
      deleteKnowledge.mutate({
        id: item.id,
        agentConfigId: item.agent_config_id,
        fileUrl: item.file_url,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Processado</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <File className="h-4 w-4 text-red-500" />;
      case 'url':
        return <Globe className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!agentConfigId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Salve a configuração do agente primeiro para adicionar conhecimento</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Knowledge Buttons */}
      <div className="flex flex-wrap gap-3">
        <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Adicionar Texto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conhecimento em Texto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="Ex: FAQ, Informações de Produtos, Políticas..."
                />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Cole aqui informações que o agente deve conhecer..."
                  rows={10}
                  className="resize-none"
                />
              </div>
              <Button 
                onClick={handleAddText} 
                disabled={!textTitle.trim() || !textContent.trim() || addTextKnowledge.isPending}
                className="w-full"
              >
                {addTextKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Adicionar URL
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar URL para Indexar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="Ex: Site Principal, Página de Produtos..."
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O conteúdo da página será extraído e disponibilizado para o agente
              </p>
              <Button 
                onClick={handleAddUrl} 
                disabled={!urlTitle.trim() || !urlValue.trim() || addUrlKnowledge.isPending}
                className="w-full"
              >
                {addUrlKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadPdfKnowledge.isPending}
        >
          {uploadPdfKnowledge.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload PDF
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Knowledge Items List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : knowledgeItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhum conhecimento adicionado</p>
          <p className="text-sm">Adicione textos, PDFs ou URLs para que o agente possa usar como referência</p>
        </div>
      ) : (
        <div className="space-y-3">
          {knowledgeItems.map((item) => (
            <Card key={item.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(item.source_type)}
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {item.source_type === 'text' && item.content && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                )}
                {item.source_type === 'url' && item.website_url && (
                  <a 
                    href={item.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {item.website_url}
                  </a>
                )}
                {item.source_type === 'pdf' && item.file_name && (
                  <p className="text-sm text-muted-foreground">{item.file_name}</p>
                )}
                {item.error_message && (
                  <p className="text-sm text-destructive mt-2">{item.error_message}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
