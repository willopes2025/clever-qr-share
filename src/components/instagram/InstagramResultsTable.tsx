import { InstagramProfile } from "@/pages/InstagramScraper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Download, Users, ExternalLink, Mail, Phone, BadgeCheck, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstagramResultsTableProps {
  profiles: InstagramProfile[];
  selectedProfiles: Set<string>;
  onSelectProfile: (id: string) => void;
  onSelectAll: () => void;
  isLoading: boolean;
  onImport: () => void;
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
  onImport
}: InstagramResultsTableProps) {
  const allSelected = profiles.length > 0 && profiles.every(p => selectedProfiles.has(p.id));
  const someSelected = selectedProfiles.size > 0;

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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resultados ({profiles.length})
          </CardTitle>
          {someSelected && (
            <Button onClick={onImport} className="gap-2">
              <Download className="h-4 w-4" />
              Importar {selectedProfiles.size} selecionado(s)
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
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
                <TableHead>Bio</TableHead>
                <TableHead className="text-center">Seguidores</TableHead>
                <TableHead className="text-center">Posts</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Data Scrape</TableHead>
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
                          {profile.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
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
                        {profile.full_name && (
                          <p className="text-sm text-muted-foreground">
                            {profile.full_name}
                          </p>
                        )}
                        <div className="flex gap-1">
                          {profile.is_business_account && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Briefcase className="h-3 w-3" />
                              Business
                            </Badge>
                          )}
                          {profile.business_category && (
                            <Badge variant="outline" className="text-xs">
                              {profile.business_category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {profile.biography || '-'}
                    </p>
                    {profile.external_url && (
                      <a
                        href={profile.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">{formatNumber(profile.followers_count)}</span>
                    <p className="text-xs text-muted-foreground">
                      seguindo {formatNumber(profile.following_count)}
                    </p>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(profile.posts_count)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {profile.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{profile.email}</span>
                        </div>
                      )}
                      {profile.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{profile.phone}</span>
                        </div>
                      )}
                      {!profile.email && !profile.phone && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {format(new Date(profile.scraped_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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