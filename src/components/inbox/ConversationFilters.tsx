import { useState } from "react";
import { Filter, Phone, Tag, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useConversationTags } from "@/hooks/useConversationTags";
import { cn } from "@/lib/utils";

export interface ConversationFilters {
  instanceId: string | null;
  tagId: string | null;
  dateFilter: 'all' | 'today' | '7days' | '30days';
}

interface ConversationFiltersProps {
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
}

const dateFilterOptions = [
  { value: 'all', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: '7days', label: 'Últimos 7 dias' },
  { value: '30days', label: 'Últimos 30 dias' },
];

export const ConversationFiltersComponent = ({ filters, onFiltersChange }: ConversationFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { instances } = useWhatsAppInstances();
  const { tags } = useConversationTags();

  const activeFiltersCount = [
    filters.instanceId,
    filters.tagId,
    filters.dateFilter !== 'all' ? filters.dateFilter : null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      instanceId: null,
      tagId: null,
      dateFilter: 'all',
    });
  };

  const selectedInstance = instances?.find(i => i.id === filters.instanceId);
  const selectedTag = tags?.find(t => t.id === filters.tagId);
  const selectedDateFilter = dateFilterOptions.find(d => d.value === filters.dateFilter);

  return (
    <div className="space-y-2">
      {/* Filter Button and Active Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                activeFiltersCount > 0 && "border-primary text-primary"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge
                  variant="default"
                  className="ml-1 h-5 min-w-5 px-1.5 text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Filtros</h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Limpar todos
                  </Button>
                )}
              </div>

              {/* Instance Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Telefone conectado
                </label>
                <Select
                  value={filters.instanceId || "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      instanceId: value === "all" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos os telefones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os telefones</SelectItem>
                    {instances?.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tag Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  Tag
                </label>
                <Select
                  value={filters.tagId || "all"}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      tagId: value === "all" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    {tags?.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Período
                </label>
                <Select
                  value={filters.dateFilter}
                  onValueChange={(value) =>
                    onFiltersChange({
                      ...filters,
                      dateFilter: value as ConversationFilters['dateFilter'],
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active Filter Chips */}
        {filters.instanceId && selectedInstance && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Phone className="h-3 w-3" />
            {selectedInstance.instance_name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, instanceId: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.tagId && selectedTag && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedTag.color }}
            />
            {selectedTag.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, tagId: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {filters.dateFilter !== 'all' && selectedDateFilter && (
          <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
            <Calendar className="h-3 w-3" />
            {selectedDateFilter.label}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 ml-1 hover:bg-transparent"
              onClick={() => onFiltersChange({ ...filters, dateFilter: 'all' })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>
    </div>
  );
};
