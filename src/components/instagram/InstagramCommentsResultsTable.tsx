import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, MessageCircle, ExternalLink, BadgeCheck, User, Heart, Reply, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface InstagramComment {
  id: string;
  post_url: string;
  post_id: string | null;
  comment_id: string;
  comment_text: string;
  commenter_username: string;
  commenter_full_name: string | null;
  commenter_profile_pic: string | null;
  commenter_is_verified: boolean;
  likes_count: number;
  timestamp: string | null;
  is_reply: boolean;
  parent_comment_id: string | null;
  scraped_at: string;
}

interface InstagramCommentsResultsTableProps {
  comments: InstagramComment[];
  selectedComments: Set<string>;
  onSelectComment: (id: string) => void;
  onSelectAll: () => void;
  isLoading: boolean;
  onImport: () => void;
}

export function InstagramCommentsResultsTable({
  comments,
  selectedComments,
  onSelectComment,
  onSelectAll,
  isLoading,
  onImport
}: InstagramCommentsResultsTableProps) {
  const allSelected = comments.length > 0 && comments.every(c => selectedComments.has(c.id));
  const someSelected = selectedComments.size > 0;

  // Group comments by post URL
  const groupedByPost = comments.reduce((acc, comment) => {
    const url = comment.post_url || 'unknown';
    if (!acc[url]) acc[url] = [];
    acc[url].push(comment);
    return acc;
  }, {} as Record<string, InstagramComment[]>);

  const postCount = Object.keys(groupedByPost).length;
  const repliesCount = comments.filter(c => c.is_reply).length;
  const topLevelCount = comments.length - repliesCount;

  // Get unique commenters
  const uniqueCommenters = new Set(comments.map(c => c.commenter_username)).size;

  if (comments.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum comentário encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comentários ({comments.length})
            </CardTitle>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{postCount} post(s)</span>
              <span>{topLevelCount} comentários</span>
              <span>{repliesCount} respostas</span>
              <span>{uniqueCommenters} usuários únicos</span>
            </div>
          </div>
          {someSelected && (
            <div className="flex items-center gap-2">
              <Button onClick={onImport} className="gap-2">
                <Download className="h-4 w-4" />
                Importar {selectedComments.size}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="min-w-[300px]">Comentário</TableHead>
                <TableHead className="text-center">Curtidas</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedComments.has(comment.id)}
                      onCheckedChange={() => onSelectComment(comment.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comment.commenter_profile_pic || undefined} />
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://instagram.com/${comment.commenter_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            @{comment.commenter_username}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {comment.commenter_is_verified && (
                            <BadgeCheck className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        {comment.commenter_full_name && (
                          <span className="text-xs text-muted-foreground">
                            {comment.commenter_full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm line-clamp-2 max-w-[300px]">
                            {comment.comment_text || '-'}
                          </p>
                        </TooltipTrigger>
                        {comment.comment_text && comment.comment_text.length > 100 && (
                          <TooltipContent className="max-w-md">
                            <p className="text-xs whitespace-pre-wrap">{comment.comment_text}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" />
                      <span className="text-sm">{comment.likes_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {comment.is_reply ? (
                      <Badge variant="secondary" className="gap-1">
                        <Reply className="h-3 w-3" />
                        Resposta
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <MessageCircle className="h-3 w-3" />
                        Comentário
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={comment.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:underline flex items-center gap-1 max-w-[150px] truncate"
                    >
                      {comment.post_id || 'Ver post'}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {comment.timestamp 
                      ? format(new Date(comment.timestamp), "dd/MM/yy HH:mm", { locale: ptBR })
                      : format(new Date(comment.scraped_at), "dd/MM/yy HH:mm", { locale: ptBR })
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
