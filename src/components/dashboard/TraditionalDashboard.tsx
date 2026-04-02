import { useState } from 'react';
import { DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import { DashboardDateFilter } from './DashboardDateFilter';
import { OverviewSection } from './OverviewSection';
import { WhatsAppSection } from './WhatsAppSection';
import { LeadsSection } from './LeadsSection';
import { LeadChannelsSection } from './LeadChannelsSection';
import { CampaignDispatchSection } from './CampaignDispatchSection';
import { FunnelSection } from './FunnelSection';
import { FinancialSection } from './FinancialSection';
import { AutomationSection } from './AutomationSection';
import { AgentPerformanceSection } from './AgentPerformanceSection';
import { AlertsSection } from './AlertsSection';

export const TraditionalDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customRange, setCustomRange] = useState<CustomDateRange | undefined>(undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão completa de performance</p>
        </div>
        <DashboardDateFilter 
          value={dateRange} 
          onChange={setDateRange} 
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      <OverviewSection dateRange={dateRange} customRange={customRange} />

      {/* Disparos + Leads por Canal */}
      <CampaignDispatchSection dateRange={dateRange} customRange={customRange} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WhatsAppSection dateRange={dateRange} customRange={customRange} />
        <LeadChannelsSection dateRange={dateRange} customRange={customRange} />
      </div>

      <FunnelSection dateRange={dateRange} customRange={customRange} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialSection dateRange={dateRange} customRange={customRange} />
        <AutomationSection dateRange={dateRange} customRange={customRange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentPerformanceSection dateRange={dateRange} customRange={customRange} />
        <AlertsSection />
      </div>
    </div>
  );
};
