import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InstagramSearchForm } from "@/components/instagram/InstagramSearchForm";
import { InstagramResultsTable } from "@/components/instagram/InstagramResultsTable";
import { ImportInstagramLeadsDialog } from "@/components/instagram/ImportInstagramLeadsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, Search, History } from "lucide-react";
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
}

const InstagramScraper = () => {
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
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
        .limit(100);
      
      if (error) throw error;
      return data as InstagramProfile[];
    },
    enabled: activeTab === 'history'
  });

  const handleSearch = async (usernames: string[]) => {
    if (usernames.length === 0) {
      toast.error('Informe ao menos um username');
      return;
    }

    setIsSearching(true);
    setSelectedProfiles(new Set());

    try {
      const { data, error } = await supabase.functions.invoke('instagram-scraper', {
        body: { usernames }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar perfis');
      }

      setProfiles(data.data || []);
      setHasSearched(true);

      if (data.data?.length === 0) {
        toast.info('Nenhum perfil encontrado');
      } else {
        const cacheMsg = data.fromCache > 0 ? ` (${data.fromCache} do cache)` : '';
        toast.success(`${data.total} perfis encontrados${cacheMsg}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar perfis');
    } finally {
      setIsSearching(false);
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

  const currentProfiles = activeTab === 'history' ? (historicalProfiles || []) : profiles;

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
            Extraia dados de perfis públicos do Instagram e importe como leads
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Pesquisar
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
                  <Search className="h-5 w-5" />
                  Buscar Perfis
                </CardTitle>
                <CardDescription>
                  Insira os usernames (um por linha ou separados por vírgula)
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
              />
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Scrapes
                </CardTitle>
                <CardDescription>
                  Perfis extraídos anteriormente (últimos 100)
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