import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { WARMING_LEVELS } from "@/hooks/useWhatsAppInstances";
import { Funnel } from "@/hooks/useFunnels";

export interface InstanceFiltersState {
  status: 'all' | 'connected' | 'disconnected';
  warmingLevel: number | null;
  funnelId: string | null;
}

interface InstanceFiltersProps {
  filters: InstanceFiltersState;
  onFiltersChange: (filters: InstanceFiltersState) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  funnels: Funnel[];
}

export const InstanceFilters = ({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  funnels,
}: InstanceFiltersProps) => {
  const activeFiltersCount = [
    filters.status !== 'all',
    filters.warmingLevel !== null,
    filters.funnelId !== null,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Status Filter */}
      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value as InstanceFiltersState['status'] })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="connected">Conectados</SelectItem>
          <SelectItem value="disconnected">Desconectados</SelectItem>
        </SelectContent>
      </Select>

      {/* Warming Level Filter */}
      <Select
        value={filters.warmingLevel?.toString() || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          warmingLevel: value === 'all' ? null : parseInt(value) 
        })}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Aquecimento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos níveis</SelectItem>
          {WARMING_LEVELS.map((level) => (
            <SelectItem key={level.level} value={level.level.toString()}>
              {level.icon} {level.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Funnel Filter */}
      <Select
        value={filters.funnelId || 'all'}
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          funnelId: value === 'all' ? null : value 
        })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Funil" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os funis</SelectItem>
          <SelectItem value="none">Sem funil</SelectItem>
          {funnels.map((funnel) => (
            <SelectItem key={funnel.id} value={funnel.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 w-2 rounded-full" 
                  style={{ backgroundColor: funnel.color }}
                />
                {funnel.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ status: 'all', warmingLevel: null, funnelId: null })}
          className="text-muted-foreground"
        >
          Limpar ({activeFiltersCount})
        </Button>
      )}

      {/* View Mode Toggle */}
      <div className="flex gap-1 ml-auto border rounded-lg p-1">
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewModeChange('grid')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => onViewModeChange('list')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
