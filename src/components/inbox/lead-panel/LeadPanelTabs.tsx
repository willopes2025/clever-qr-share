import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { ManageTabsDialog } from "./ManageTabsDialog";

interface LeadPanelTabsProps {
  activeTab: string | null;
  onTabChange: (tabId: string) => void;
}

export const LeadPanelTabs = ({ activeTab, onTabChange }: LeadPanelTabsProps) => {
  const { tabs, isLoading } = useLeadPanelTabs();
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && tabs && tabs.length > 0 && !activeTab) {
      onTabChange(tabs[0].id);
    }
  }, [isLoading, tabs, activeTab, onTabChange]);

  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b border-border/30">
        <div className="h-8 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5 bg-muted/20">
        <div className="flex-1 min-w-0">
          <Select value={activeTab || undefined} onValueChange={onTabChange}>
            <SelectTrigger className="h-9 text-sm font-medium bg-background border-border/50">
              <SelectValue placeholder="Selecione uma aba" />
            </SelectTrigger>
            <SelectContent>
              {tabs?.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 hover:bg-muted"
          onClick={() => setManageOpen(true)}
          aria-label="Configurar abas"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <ManageTabsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
};
