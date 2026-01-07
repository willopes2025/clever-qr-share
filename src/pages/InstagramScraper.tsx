import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InstagramSearchForm, ScrapeType } from "@/components/instagram/InstagramSearchForm";
import { InstagramResultsTable } from "@/components/instagram/InstagramResultsTable";
import { ImportInstagramLeadsDialog } from "@/components/instagram/ImportInstagramLeadsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, Search, History, Users } from "lucide-react";
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

    if (selectedIds.length > 50) {
      toast.warning('Máximo de 50 perfis por enriquecimento.');
    }

    setIsEnriching(true);

    try {
      const { data, error } = await supabase.functions.invoke('instagram-enricher', {
        body: { profileIds: selectedIds.slice(0, 50) }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao enriquecer perfis');
      }

      // Update the profiles in state with enriched data
      const enrichedMap = new Map<string, InstagramProfile>(
        data.data.map((p: InstagramProfile) => [p.id, p])
      );
      
      if (activeTab === 'search') {
        setProfiles(prev => prev.map(p => enrichedMap.get(p.id) ?? p));
      }
      
      refetchHistory();
      toast.success(`${data.total} perfis enriquecidos com sucesso!`);
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

  const getSelectedProfilesData = (): InstagramProfile[] => {
    const allProfiles = activeTab === 'history' ? (historicalProfiles || []) : profiles;
    return allProfiles.filter(p => selectedProfiles.has(p.id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Instagram className="h-8 w-8 text-primary" />
            Instagram Scraper
          </h1>
          <p className="text-muted-foreground mt-1">
            Extraia seguidores ou seguidos de perfis do Instagram e importe como leads
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Extrair
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
      </div>
    </DashboardLayout>
  );
};

export default InstagramScraper;
