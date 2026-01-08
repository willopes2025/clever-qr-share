import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeadPanelTabs } from "@/hooks/useLeadPanelTabs";
import { ManageTabsDialog } from "./ManageTabsDialog";

interface LeadPanelTabsProps {
  activeTab: string | null;
  onTabChange: (tabId: string) => void;
}

export const LeadPanelTabs = ({ activeTab, onTabChange }: LeadPanelTabsProps) => {
  const { tabs, isLoading } = useLeadPanelTabs();
  const [manageOpen, setManageOpen] = useState(false);

  // Set default tab on first load - using useEffect to avoid state update during render
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
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-1.5 overflow-x-auto scrollbar-hide bg-muted/20">
        {tabs?.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/70 hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.name}
          </button>
        ))}
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0 ml-auto hover:bg-muted"
          onClick={() => setManageOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <ManageTabsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
};
