import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, FileText, Image, Mic, Video, Smile } from "lucide-react";
import { WarmingContent } from "@/hooks/useWarming";

interface WarmingContentManagerProps {
  contents: WarmingContent[];
  onAdd: (data: { 
    contentType: 'text' | 'audio' | 'image' | 'video' | 'sticker';
    content?: string;
    mediaUrl?: string;
    category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
  }) => void;
  onDelete: (contentId: string) => void;
  isAdding?: boolean;
}

const CATEGORIES = [
  { value: 'greeting', label: 'Saudação', icon: '👋' },
  { value: 'casual', label: 'Casual', icon: '💬' },
  { value: 'question', label: 'Pergunta', icon: '❓' },
  { value: 'reaction', label: 'Reação', icon: '😄' },
  { value: 'farewell', label: 'Despedida', icon: '👋' },
];

const CONTENT_TYPES = [
  { value: 'text', label: 'Texto', icon: FileText },
  { value: 'image', label: 'Imagem', icon: Image },
  { value: 'audio', label: 'Áudio', icon: Mic },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'sticker', label: 'Sticker', icon: Smile },
];

export function WarmingContentManager({ contents, onAdd, onDelete, isAdding }: WarmingContentManagerProps) {
  const [open, setOpen] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'audio' | 'image' | 'video' | 'sticker'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [category, setCategory] = useState<'greeting' | 'casual' | 'question' | 'reaction' | 'farewell'>('casual');

  const handleSubmit = () => {
    if (contentType === 'text' && !content.trim()) return;
    if (contentType !== 'text' && !mediaUrl.trim()) return;
    
    onAdd({ 
      contentType, 
      content: content.trim() || undefined, 
      mediaUrl: mediaUrl.trim() || undefined, 
      category 
    });
    setContent('');
    setMediaUrl('');
    setCategory('casual');
    setOpen(false);
  };

  // Separate user content from default content
  const userContents = contents.filter(c => c.user_id !== '00000000-0000-0000-0000-000000000000');
  const defaultContents = contents.filter(c => c.user_id === '00000000-0000-0000-0000-000000000000');

  const getTypeIcon = (type: string) => {
    const typeInfo = CONTENT_TYPES.find(t => t.value === type);
    if (!typeInfo) return <FileText className="h-4 w-4" />;
    const Icon = typeInfo.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryBadge = (cat: string) => {
    const catInfo = CATEGORIES.find(c => c.value === cat);
    return catInfo ? `${catInfo.icon} ${catInfo.label}` : cat;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Banco de Conteúdos
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conteúdo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select 
                  value={contentType} 
                  onValueChange={(v) => setContentType(v as typeof contentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={category} 
                  onValueChange={(v) => setCategory(v as typeof category)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {contentType === 'text' ? (
                <div className="space-y-2">
                  <Label>Texto da Mensagem</Label>
                  <Textarea 
                    placeholder="Digite a mensagem..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>URL da Mídia</Label>
                  <Input 
                    placeholder="https://exemplo.com/arquivo.jpg"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL pública para a mídia (imagem, áudio ou vídeo)
                  </p>
                  <div className="space-y-2">
                    <Label>Legenda (opcional)</Label>
                    <Input 
                      placeholder="Legenda da mídia"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button 
                onClick={handleSubmit} 
                disabled={
                  (contentType === 'text' && !content.trim()) || 
                  (contentType !== 'text' && !mediaUrl.trim()) || 
                  isAdding
                } 
                className="w-full"
              >
                Adicionar Conteúdo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="user">
          <TabsList className="w-full">
            <TabsTrigger value="user" className="flex-1">
              Meus Conteúdos ({userContents.length})
            </TabsTrigger>
            <TabsTrigger value="default" className="flex-1">
              Padrão ({defaultContents.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="user" className="mt-4">
            {userContents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Você ainda não adicionou conteúdos personalizados.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userContents.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getTypeIcon(item.content_type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">
                          {item.content || item.media_url || 'Sem conteúdo'}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {getCategoryBadge(item.category)}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="default" className="mt-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {defaultContents.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  {getTypeIcon(item.content_type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      {item.content || item.media_url || 'Sem conteúdo'}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {getCategoryBadge(item.category)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
