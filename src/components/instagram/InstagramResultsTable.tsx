import { InstagramProfile } from "@/pages/InstagramScraper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Users, ExternalLink, BadgeCheck, Lock, User, Sparkles, Mail, Phone, Loader2, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstagramResultsTableProps {
  profiles: InstagramProfile[];
  selectedProfiles: Set<string>;
  onSelectProfile: (id: string) => void;
  onSelectAll: () => void;
  isLoading: boolean;
  onImport: () => void;
  onEnrich: () => void;
  isEnriching: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function InstagramResultsTable({
  profiles,
  selectedProfiles,
  onSelectProfile,
  onSelectAll,
  isLoading,
  onImport,
  onEnrich,
  isEnriching
}: InstagramResultsTableProps) {
  const allSelected = profiles.length > 0 && profiles.every(p => selectedProfiles.has(p.id));
  const someSelected = selectedProfiles.size > 0;

  // Group profiles by source username
  const groupedBySource = profiles.reduce((acc, profile) => {
    const source = profile.source_username || 'unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(profile);
    return acc;
  }, {} as Record<string, InstagramProfile[]>);

  const sources = Object.keys(groupedBySource);

  if (profiles.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum perfil encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resultados ({profiles.length})
            {sources.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                de {sources.length} perfil(is)
              </span>
            )}
          </CardTitle>
          {someSelected && (
            <div className="flex items-center gap-2">
              <Button 
                onClick={onEnrich} 
                variant="outline" 
                className="gap-2"
                disabled={isEnriching}
              >
                {isEnriching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Enriquecer {selectedProfiles.size}
              </Button>
              <Button onClick={onImport} className="gap-2">
                <Download className="h-4 w-4" />
                Importar {selectedProfiles.size}
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
                <TableHead>Perfil</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Dados</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProfiles.has(profile.id)}
                      onCheckedChange={() => onSelectProfile(profile.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile.profile_pic_url || undefined} />
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1">
                          <a
                            href={`https://instagram.com/${profile.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            @{profile.username}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {profile.is_verified && (
                            <BadgeCheck className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground line-clamp-1 max-w-[150px]">
                            {profile.full_name || '-'}
                          </span>
                        </TooltipTrigger>
                        {profile.biography && (
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{profile.biography}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      {profile.is_private ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Privado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <User className="h-3 w-3" />
                          Público
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {profile.enriched_at ? (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Enriquecido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Básico
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.email ? (
                      <a 
                        href={`mailto:${profile.email}`} 
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {profile.email}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.phone ? (
                      <a 
                        href={`tel:${profile.phone}`} 
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {profile.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {profile.source_username && (
                      <a
                        href={`https://instagram.com/${profile.source_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                      >
                        @{profile.source_username}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {profile.scrape_type && (
                      <span className="text-xs text-muted-foreground capitalize">
                        ({profile.scrape_type === 'followers' ? 'seguidor' : 'seguindo'})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(profile.scraped_at), "dd/MM/yy HH:mm", { locale: ptBR })}
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
