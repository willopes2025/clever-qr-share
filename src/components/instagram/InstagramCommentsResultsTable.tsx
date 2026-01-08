import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, MessageCircle, ExternalLink, BadgeCheck, User, Heart, Reply, Loader2, Sparkles, Mail, Phone, CheckCircle } from "lucide-react";
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
  // Enrichment fields
  commenter_biography?: string | null;
  commenter_email?: string | null;
  commenter_phone?: string | null;
  commenter_followers_count?: number;
  commenter_following_count?: number;
  commenter_posts_count?: number;
  commenter_is_business?: boolean;
  commenter_business_category?: string | null;
  commenter_external_url?: string | null;
  enriched_at?: string | null;
}

interface InstagramCommentsResultsTableProps {
  comments: InstagramComment[];
  selectedComments: Set<string>;
  onSelectComment: (id: string) => void;
  onSelectAll: () => void;
  isLoading: boolean;
  onImport: () => void;
  onEnrich?: () => void;
  isEnriching?: boolean;
  onSelectByFilter?: (filter: 'not-enriched' | 'with-email' | 'with-phone' | 'with-contact') => void;
}

export function InstagramCommentsResultsTable({
  comments,
  selectedComments,
  onSelectComment,
  onSelectAll,
  isLoading,
  onImport,
  onEnrich,
  isEnriching,
  onSelectByFilter
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

  // Enrichment stats
  const enrichedCount = comments.filter(c => c.enriched_at).length;
  const notEnrichedCount = comments.length - enrichedCount;
  const withEmailCount = comments.filter(c => c.commenter_email).length;
  const withPhoneCount = comments.filter(c => c.commenter_phone).length;
  const withContactCount = comments.filter(c => c.commenter_email || c.commenter_phone).length;

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
              {onEnrich && (
                <Button 
                  variant="outline" 
                  onClick={onEnrich} 
                  disabled={isEnriching}
                  className="gap-2"
                >
                  {isEnriching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Enriquecer {selectedComments.size}
                </Button>
              )}
              <Button onClick={onImport} className="gap-2">
                <Download className="h-4 w-4" />
                Importar {selectedComments.size}
              </Button>
            </div>
          )}
        </div>

        {/* Quick filter buttons */}
        {onSelectByFilter && comments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-sm text-muted-foreground self-center">Selecionar:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectByFilter('not-enriched')}
              className="gap-1"
            >
              Não enriquecidos ({notEnrichedCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectByFilter('with-email')}
              className="gap-1"
            >
              <Mail className="h-3 w-3" />
              Com email ({withEmailCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectByFilter('with-phone')}
              className="gap-1"
            >
              <Phone className="h-3 w-3" />
              Com telefone ({withPhoneCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectByFilter('with-contact')}
              className="gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Com contato ({withContactCount})
            </Button>
          </div>
        )}
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
                <TableHead className="min-w-[250px]">Comentário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">Seguidores</TableHead>
                <TableHead className="text-center">Curtidas</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-center">Status</TableHead>
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
                          <p className="text-sm line-clamp-2 max-w-[250px]">
                            {comment.comment_text || '-'}
                          </p>
                        </TooltipTrigger>
                        {comment.comment_text && comment.comment_text.length > 80 && (
                          <TooltipContent className="max-w-md">
                            <p className="text-xs whitespace-pre-wrap">{comment.comment_text}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {comment.commenter_email ? (
                      <a 
                        href={`mailto:${comment.commenter_email}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {comment.commenter_email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {comment.commenter_phone ? (
                      <a 
                        href={`https://wa.me/${comment.commenter_phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {comment.commenter_phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm">
                      {comment.commenter_followers_count?.toLocaleString() || '-'}
                    </span>
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
                  <TableCell className="text-center">
                    {comment.enriched_at ? (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <Sparkles className="h-3 w-3" />
                        Enriquecido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pendente
                      </Badge>
                    )}
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
