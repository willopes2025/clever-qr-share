import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, FileText, Image, Mic, Video, Smile, Sparkles, Loader2, Pencil } from "lucide-react";
import { WarmingContent } from "@/hooks/useWarming";
import { useGenerateWarmingContent } from "@/hooks/useGenerateWarmingContent";

interface WarmingContentManagerProps {
  contents: WarmingContent[];
  onAdd: (data: { 
    contentType: 'text' | 'audio' | 'image' | 'video' | 'sticker';
    content?: string;
    mediaUrl?: string;
    category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
  }) => void;
  onUpdate: (data: {
    contentId: string;
    contentType: 'text' | 'audio' | 'image' | 'video' | 'sticker';
    content?: string;
    mediaUrl?: string;
    category: 'greeting' | 'casual' | 'question' | 'reaction' | 'farewell';
  }) => void;
  onDelete: (contentId: string) => void;
  onDeleteAll?: () => void;
  isAdding?: boolean;
  isUpdating?: boolean;
  isDeletingAll?: boolean;
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

const QUANTITY_OPTIONS = [3, 5, 10, 15, 20];

export function WarmingContentManager({ contents, onAdd, onUpdate, onDelete, onDeleteAll, isAdding, isUpdating, isDeletingAll }: WarmingContentManagerProps) {
  const [open, setOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [contentType, setContentType] = useState<'text' | 'audio' | 'image' | 'video' | 'sticker'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [category, setCategory] = useState<'greeting' | 'casual' | 'question' | 'reaction' | 'farewell'>('casual');
  
  // AI generation state
  const [aiCategory, setAiCategory] = useState<'greeting' | 'casual' | 'question' | 'reaction' | 'farewell'>('casual');
  const [aiQuantity, setAiQuantity] = useState(5);
  
  // Selection state for default contents
  const [selectedDefaultIds, setSelectedDefaultIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<WarmingContent | null>(null);
  const [editContentType, setEditContentType] = useState<'text' | 'audio' | 'image' | 'video' | 'sticker'>('text');
  const [editContent, setEditContent] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editCategory, setEditCategory] = useState<'greeting' | 'casual' | 'question' | 'reaction' | 'farewell'>('casual');
  
  const { generateAndSave, isGenerating } = useGenerateWarmingContent();

  const handleOpenEdit = (item: WarmingContent) => {
    setEditingContent(item);
    setEditContentType(item.content_type);
    setEditContent(item.content || '');
    setEditMediaUrl(item.media_url || '');
    setEditCategory(item.category);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingContent) return;
    if (editContentType === 'text' && !editContent.trim()) return;
    if (editContentType !== 'text' && !editMediaUrl.trim()) return;
    
    onUpdate({
      contentId: editingContent.id,
      contentType: editContentType,
      content: editContent.trim() || undefined,
      mediaUrl: editMediaUrl.trim() || undefined,
      category: editCategory,
    });
    
    setEditDialogOpen(false);
    setEditingContent(null);
  };

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

  const handleGenerateWithAI = async () => {
    await generateAndSave.mutateAsync({ category: aiCategory, quantity: aiQuantity });
    setAiDialogOpen(false);
  };

  const toggleSelectDefault = (id: string) => {
    setSelectedDefaultIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllDefaults = () => {
    if (selectedDefaultIds.size === defaultContents.length) {
      setSelectedDefaultIds(new Set());
    } else {
      setSelectedDefaultIds(new Set(defaultContents.map(c => c.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    try {
      for (const id of selectedDefaultIds) {
        onDelete(id);
      }
      setSelectedDefaultIds(new Set());
    } finally {
      setIsDeleting(false);
    }
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
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Banco de Conteúdos
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* AI Generate Button */}
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar com IA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Mensagens com IA</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={aiCategory} 
                    onValueChange={(v) => setAiCategory(v as typeof aiCategory)}
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

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Select 
                    value={String(aiQuantity)} 
                    onValueChange={(v) => setAiQuantity(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUANTITY_OPTIONS.map((qty) => (
                        <SelectItem key={qty} value={String(qty)}>
                          {qty} mensagens
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGenerateWithAI} 
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Mensagens
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Content Button */}
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

          {/* Delete All Button */}
          {userContents.length > 0 && onDeleteAll && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os conteúdos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover todos os {userContents.length} conteúdos que você criou. 
                    Os conteúdos padrão não serão afetados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={onDeleteAll}
                    disabled={isDeletingAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Removendo...
                      </>
                    ) : (
                      'Limpar Tudo'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
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
              <div className="space-y-2 flex-1 overflow-y-auto">
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
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="default" className="mt-4">
            {defaultContents.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedDefaultIds.size === defaultContents.length && defaultContents.length > 0}
                    onCheckedChange={toggleSelectAllDefaults}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    Selecionar todos
                  </Label>
                </div>
                {selectedDefaultIds.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir ({selectedDefaultIds.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir mensagens selecionadas?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá remover {selectedDefaultIds.size} mensagem(ns) do banco de conteúdos padrão.
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSelected}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Excluindo...
                            </>
                          ) : (
                            'Excluir Selecionados'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            <div className="space-y-2 flex-1 overflow-y-auto">
              {defaultContents.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedDefaultIds.has(item.id) ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                  }`}
                  onClick={() => toggleSelectDefault(item.id)}
                >
                  <Checkbox
                    checked={selectedDefaultIds.has(item.id)}
                    onCheckedChange={() => toggleSelectDefault(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
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

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conteúdo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select 
                  value={editContentType} 
                  onValueChange={(v) => setEditContentType(v as typeof editContentType)}
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
                  value={editCategory} 
                  onValueChange={(v) => setEditCategory(v as typeof editCategory)}
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

              {editContentType === 'text' ? (
                <div className="space-y-2">
                  <Label>Texto da Mensagem</Label>
                  <Textarea 
                    placeholder="Digite a mensagem..."
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>URL da Mídia</Label>
                  <Input 
                    placeholder="https://exemplo.com/arquivo.jpg"
                    value={editMediaUrl}
                    onChange={(e) => setEditMediaUrl(e.target.value)}
                  />
                  <div className="space-y-2">
                    <Label>Legenda (opcional)</Label>
                    <Input 
                      placeholder="Legenda da mídia"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button 
                onClick={handleSaveEdit} 
                disabled={
                  (editContentType === 'text' && !editContent.trim()) || 
                  (editContentType !== 'text' && !editMediaUrl.trim()) || 
                  isUpdating
                } 
                className="w-full"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
