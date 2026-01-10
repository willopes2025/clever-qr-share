import { useState, useMemo } from "react";
import { Search, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AvailableWidget, 
  groupWidgetsByCategory, 
  categoryLabels,
  WidgetConfig 
} from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { getWidgetIcon } from "./WidgetIcons";

interface KPISelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableWidgets: AvailableWidget[];
  currentWidgets: WidgetConfig[];
  onAddWidgets: (widgets: AvailableWidget[]) => void;
}

export const KPISelectionModal = ({
  open,
  onOpenChange,
  availableWidgets,
  currentWidgets,
  onAddWidgets
}: KPISelectionModalProps) => {
  const { isAdmin } = useUserRole();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWidgets, setSelectedWidgets] = useState<AvailableWidget[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");

  // Filter widgets based on user role and already added widgets
  const filteredWidgets = useMemo(() => {
    const currentWidgetKeys = currentWidgets.map(w => w.widget_key);
    
    return availableWidgets.filter(widget => {
      // Filter out already added widgets
      if (currentWidgetKeys.includes(widget.widget_key)) return false;
      
      // Filter by role permissions
      if (widget.admin_only && !isAdmin) return false;
      if (widget.member_only && isAdmin) return false;
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          widget.name.toLowerCase().includes(query) ||
          widget.description?.toLowerCase().includes(query) ||
          widget.category.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [availableWidgets, currentWidgets, isAdmin, searchQuery]);

  // Group by category
  const groupedWidgets = useMemo(() => {
    return groupWidgetsByCategory(filteredWidgets);
  }, [filteredWidgets]);

  const categories = Object.keys(groupedWidgets);

  const toggleWidget = (widget: AvailableWidget) => {
    setSelectedWidgets(prev => {
      const exists = prev.find(w => w.widget_key === widget.widget_key);
      if (exists) {
        return prev.filter(w => w.widget_key !== widget.widget_key);
      }
      return [...prev, widget];
    });
  };

  const isSelected = (widget: AvailableWidget) => {
    return selectedWidgets.some(w => w.widget_key === widget.widget_key);
  };

  const handleConfirm = () => {
    onAddWidgets(selectedWidgets);
    setSelectedWidgets([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedWidgets([]);
    onOpenChange(false);
  };

  const renderWidgetCard = (widget: AvailableWidget) => {
    const IconComponent = getWidgetIcon(widget.icon);
    const selected = isSelected(widget);

    return (
      <div
        key={widget.widget_key}
        onClick={() => toggleWidget(widget)}
        className={`
          relative p-4 rounded-lg border cursor-pointer transition-all
          ${selected 
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' 
            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
          }
        `}
      >
        <div className="flex items-start gap-3">
          <div className={`
            p-2 rounded-md 
            ${selected ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-muted'}
          `}>
            <IconComponent className={`h-5 w-5 ${selected ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground truncate">
              {widget.name}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {widget.description}
            </p>
          </div>

          <Checkbox 
            checked={selected}
            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
          />
        </div>

        {widget.admin_only && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
            Admin
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Adicionar KPIs ao Dashboard</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar KPIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected count */}
        {selectedWidgets.length > 0 && (
          <div className="flex items-center gap-2 py-2">
            <Badge variant="default" className="bg-emerald-600">
              {selectedWidgets.length} selecionado{selectedWidgets.length > 1 ? 's' : ''}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedWidgets([])}
              className="text-muted-foreground text-xs"
            >
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex flex-col min-h-0">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="all" className="shrink-0">
              Todos ({filteredWidgets.length})
            </TabsTrigger>
            {categories.map(category => (
              <TabsTrigger key={category} value={category} className="shrink-0">
                {categoryLabels[category] || category} ({groupedWidgets[category].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 h-[350px] overflow-hidden">
            <ScrollArea className="h-full">
              <div className="pr-4">
                <TabsContent value="all" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                    {filteredWidgets.map(renderWidgetCard)}
                  </div>
                </TabsContent>

                {categories.map(category => (
                  <TabsContent key={category} value={category} className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                      {groupedWidgets[category].map(renderWidgetCard)}
                    </div>
                  </TabsContent>
                ))}
              </div>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedWidgets.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Adicionar {selectedWidgets.length > 0 ? `(${selectedWidgets.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
