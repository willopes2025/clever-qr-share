import { useState } from "react";
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

  // Set default tab on first load
  if (!isLoading && tabs && tabs.length > 0 && !activeTab) {
    onTabChange(tabs[0].id);
  }

  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b border-border/30">
        <div className="h-8 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className="px-3 py-1.5 border-b border-border/30 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {tabs?.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {tab.name}
          </button>
        ))}
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 shrink-0 ml-auto"
          onClick={() => setManageOpen(true)}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ManageTabsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
};
