import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InstagramSearchForm, ScrapeType } from "@/components/instagram/InstagramSearchForm";
import { InstagramResultsTable } from "@/components/instagram/InstagramResultsTable";
import { InstagramCommentsSearchForm } from "@/components/instagram/InstagramCommentsSearchForm";
import { InstagramCommentsResultsTable, InstagramComment } from "@/components/instagram/InstagramCommentsResultsTable";
import { ImportInstagramLeadsDialog } from "@/components/instagram/ImportInstagramLeadsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, Search, History, Users, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export interface InstagramProfile {
  id: string;
  username: string;
  full_name: string | null;
  biography: string | null;
  profile_pic_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_business_account: boolean;
  is_verified: boolean;
  business_category: string | null;
  external_url: string | null;
  email: string | null;
  phone: string | null;
  scraped_at: string;
  source_username?: string | null;
  scrape_type?: string | null;
  is_private?: boolean;
  enriched_at?: string | null;
}

const InstagramScraper = () => {
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  // Comments state
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [selectedComments, setSelectedComments] = useState<Set<string>>(new Set());
  const [isSearchingComments, setIsSearchingComments] = useState(false);
  const [isEnrichingComments, setIsEnrichingComments] = useState(false);
  const [hasSearchedComments, setHasSearchedComments] = useState(false);
  const [commentsImportDialogOpen, setCommentsImportDialogOpen] = useState(false);

  // Fetch historical scrape results
  const { data: historicalProfiles, refetch: refetchHistory } = useQuery({
    queryKey: ['instagram-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_scrape_results')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data as InstagramProfile[];
    },
    enabled: activeTab === 'history'
  });

  // Fetch historical comments
  const { data: historicalComments, refetch: refetchCommentsHistory } = useQuery({
    queryKey: ['instagram-comments-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_comments')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data as InstagramComment[];
    },
    enabled: activeTab === 'comments-history'
  });

  const handleSearch = async (usernames: string[], scrapeType: ScrapeType, limit: number) => {
    if (usernames.length === 0) {
      toast.error('Informe ao menos um username');
      return;
    }

    if (usernames.length > 5) {
      toast.warning('Máximo de 5 perfis por busca. Apenas os 5 primeiros serão processados.');
    }

    setIsSearching(true);
    setSelectedProfiles(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('instagram-scraper', {
        body: { usernames, scrapeType, limit }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar perfis');
      }

      setProfiles(data.data || []);
      setHasSearched(true);

      if (data.data?.length === 0) {
        toast.info('Nenhum resultado encontrado. Verifique se os perfis são públicos.');
      } else {
        const cacheMsg = data.fromCache > 0 ? ` (${data.fromCache} do cache)` : '';
        const typeLabel = scrapeType === 'Followers' ? 'seguidores' : 'seguidos';
        toast.success(`${data.total} ${typeLabel} encontrados${cacheMsg}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar perfis');
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrich = async () => {
    const selectedIds = Array.from(selectedProfiles);
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos um perfil para enriquecer');
      return;
    }

    setIsEnriching(true);
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(selectedIds.length / BATCH_SIZE);
    let totalEnriched = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batchIds = selectedIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        if (totalBatches > 1) {
          toast.info(`Enriquecendo lote ${i + 1} de ${totalBatches}...`);
        }

        const { data, error } = await supabase.functions.invoke('instagram-enricher', {
          body: { profileIds: batchIds }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao enriquecer perfis');
        }

        totalEnriched += data.total || 0;

        // Update the profiles in state with enriched data
        const enrichedMap = new Map<string, InstagramProfile>(
          data.data.map((p: InstagramProfile) => [p.id, p])
        );
        
        if (activeTab === 'search') {
          setProfiles(prev => prev.map(p => enrichedMap.get(p.id) ?? p));
        }
      }
      
      refetchHistory();
      toast.success(`${totalEnriched} perfis enriquecidos com sucesso!`);
    } catch (error) {
      console.error('Enrich error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enriquecer perfis');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (profileList: InstagramProfile[]) => {
    const allIds = profileList.map(p => p.id);
    const allSelected = allIds.every(id => selectedProfiles.has(id));

    if (allSelected) {
      setSelectedProfiles(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedProfiles(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleSelectByFilter = (filter: 'not-enriched' | 'with-email' | 'with-phone' | 'with-contact') => {
    const currentProfiles = activeTab === 'history' ? (historicalProfiles || []) : profiles;
    
    let filtered: InstagramProfile[];
    switch (filter) {
      case 'not-enriched':
        filtered = currentProfiles.filter(p => !p.enriched_at);
        break;
      case 'with-email':
        filtered = currentProfiles.filter(p => p.email);
        break;
      case 'with-phone':
        filtered = currentProfiles.filter(p => p.phone);
        break;
      case 'with-contact':
        filtered = currentProfiles.filter(p => p.email || p.phone);
        break;
    }
    
    setSelectedProfiles(new Set(filtered.map(p => p.id)));
  };

  const getSelectedProfilesData = (): InstagramProfile[] => {
    const allProfiles = activeTab === 'history' ? (historicalProfiles || []) : profiles;
    return allProfiles.filter(p => selectedProfiles.has(p.id));
  };

  // Comments handlers
  const handleSearchComments = async (postUrls: string[], resultsLimit: number, includeReplies: boolean) => {
    if (postUrls.length === 0) {
      toast.error('Informe ao menos uma URL de post');
      return;
    }

    if (postUrls.length > 5) {
      toast.warning('Máximo de 5 URLs por busca. Apenas as 5 primeiras serão processadas.');
    }

    setIsSearchingComments(true);
    setSelectedComments(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('instagram-comments-scraper', {
        body: { postUrls, resultsLimit, includeReplies }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar comentários');
      }

      setComments(data.data || []);
      setHasSearchedComments(true);

      if (data.data?.length === 0) {
        toast.info('Nenhum comentário encontrado.');
      } else {
        const cacheMsg = data.fromCache > 0 ? ` (${data.fromCache} do cache)` : '';
        toast.success(`${data.total} comentários encontrados${cacheMsg}`);
      }
    } catch (error) {
      console.error('Comments search error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar comentários');
    } finally {
      setIsSearchingComments(false);
    }
  };

  const handleSelectComment = (id: string) => {
    setSelectedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllComments = (commentList: InstagramComment[]) => {
    const allIds = commentList.map(c => c.id);
    const allSelected = allIds.every(id => selectedComments.has(id));

    if (allSelected) {
      setSelectedComments(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedComments(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleEnrichComments = async () => {
    const selectedIds = Array.from(selectedComments);
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos um comentário para enriquecer');
      return;
    }

    setIsEnrichingComments(true);
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(selectedIds.length / BATCH_SIZE);
    let totalEnriched = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batchIds = selectedIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        if (totalBatches > 1) {
          toast.info(`Enriquecendo lote ${i + 1} de ${totalBatches}...`);
        }

        const { data, error } = await supabase.functions.invoke('instagram-comments-enricher', {
          body: { commentIds: batchIds }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao enriquecer comentários');
        }

        totalEnriched += data.total || 0;

        // Update the comments in state with enriched data
        const enrichedMap = new Map<string, InstagramComment>(
          data.data.map((c: InstagramComment) => [c.id, c])
        );
        
        if (activeTab === 'comments') {
          setComments(prev => prev.map(c => enrichedMap.get(c.id) ?? c));
        }
      }
      
      refetchCommentsHistory();
      toast.success(`${totalEnriched} comentários enriquecidos!`);
    } catch (error) {
      console.error('Enrich comments error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enriquecer comentários');
    } finally {
      setIsEnrichingComments(false);
    }
  };

  const handleSelectCommentsByFilter = (filter: 'not-enriched' | 'with-email' | 'with-phone' | 'with-contact') => {
    const currentComments = activeTab === 'comments-history' ? (historicalComments || []) : comments;
    
    let filtered: InstagramComment[];
    switch (filter) {
      case 'not-enriched':
        filtered = currentComments.filter(c => !c.enriched_at);
        break;
      case 'with-email':
        filtered = currentComments.filter(c => c.commenter_email);
        break;
      case 'with-phone':
        filtered = currentComments.filter(c => c.commenter_phone);
        break;
      case 'with-contact':
        filtered = currentComments.filter(c => c.commenter_email || c.commenter_phone);
        break;
    }
    
    setSelectedComments(new Set(filtered.map(c => c.id)));
  };

  const getSelectedCommentsData = (): InstagramComment[] => {
    const allComments = activeTab === 'comments-history' ? (historicalComments || []) : comments;
    return allComments.filter(c => selectedComments.has(c.id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Instagram className="h-8 w-8 text-primary" />
            Leads Instagram
          </h1>
          <p className="text-muted-foreground mt-1">
            Extraia seguidores ou seguidos de perfis do Instagram e importe como leads
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search" className="gap-2">
              <Users className="h-4 w-4" />
              Seguidores
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            {/* Search Form */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Extrair Seguidores / Seguidos
                </CardTitle>
                <CardDescription>
                  Insira os perfis de onde deseja extrair a lista de seguidores ou seguidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InstagramSearchForm
                  onSearch={handleSearch}
                  isSearching={isSearching}
                />
              </CardContent>
            </Card>

            {/* Results */}
            {hasSearched && (
              <InstagramResultsTable
                profiles={profiles}
                selectedProfiles={selectedProfiles}
                onSelectProfile={handleSelectProfile}
                onSelectAll={() => handleSelectAll(profiles)}
                isLoading={isSearching}
                onImport={() => setImportDialogOpen(true)}
                onEnrich={handleEnrich}
                isEnriching={isEnriching}
                onSelectByFilter={handleSelectByFilter}
              />
            )}
          </TabsContent>

          <TabsContent value="comments" className="space-y-6">
            {/* Comments Search Form */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Extrair Comentários
                </CardTitle>
                <CardDescription>
                  Cole URLs de postagens ou reels para extrair os comentários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InstagramCommentsSearchForm
                  onSearch={handleSearchComments}
                  isSearching={isSearchingComments}
                />
              </CardContent>
            </Card>

            {/* Comments Results */}
            {hasSearchedComments && (
              <InstagramCommentsResultsTable
                comments={comments}
                selectedComments={selectedComments}
                onSelectComment={handleSelectComment}
                onSelectAll={() => handleSelectAllComments(comments)}
                isLoading={isSearchingComments}
                onImport={() => setCommentsImportDialogOpen(true)}
                onEnrich={handleEnrichComments}
                isEnriching={isEnrichingComments}
                onSelectByFilter={handleSelectCommentsByFilter}
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Extrações
                </CardTitle>
                <CardDescription>
                  Resultados extraídos anteriormente (últimos 500)
                </CardDescription>
              </CardHeader>
            </Card>

            <InstagramResultsTable
              profiles={historicalProfiles || []}
              selectedProfiles={selectedProfiles}
              onSelectProfile={handleSelectProfile}
              onSelectAll={() => handleSelectAll(historicalProfiles || [])}
              isLoading={false}
              onImport={() => setImportDialogOpen(true)}
              onEnrich={handleEnrich}
              isEnriching={isEnriching}
              onSelectByFilter={handleSelectByFilter}
            />
          </TabsContent>
        </Tabs>

        {/* Import Dialog */}
        <ImportInstagramLeadsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          profiles={getSelectedProfilesData()}
          onSuccess={() => {
            setSelectedProfiles(new Set());
            setImportDialogOpen(false);
            refetchHistory();
          }}
        />

        {/* Comments Import Dialog */}
        <ImportInstagramLeadsDialog
          open={commentsImportDialogOpen}
          onOpenChange={setCommentsImportDialogOpen}
          profiles={getSelectedCommentsData().map(c => ({
            id: c.id,
            username: c.commenter_username,
            full_name: c.commenter_full_name,
            biography: c.commenter_biography || null,
            profile_pic_url: c.commenter_profile_pic,
            followers_count: c.commenter_followers_count || 0,
            following_count: c.commenter_following_count || 0,
            posts_count: c.commenter_posts_count || 0,
            is_business_account: c.commenter_is_business || false,
            is_verified: c.commenter_is_verified,
            business_category: c.commenter_business_category || null,
            external_url: c.commenter_external_url || null,
            email: c.commenter_email || null,
            phone: c.commenter_phone || null,
            scraped_at: c.scraped_at
          }))}
          onSuccess={() => {
            setSelectedComments(new Set());
            setCommentsImportDialogOpen(false);
            refetchCommentsHistory();
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default InstagramScraper;
