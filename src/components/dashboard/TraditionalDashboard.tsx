import { useState } from 'react';
import { DateRange } from '@/hooks/useAdvancedDashboardMetrics';
import { DashboardDateFilter } from './DashboardDateFilter';
import { OverviewSection } from './OverviewSection';
import { WhatsAppSection } from './WhatsAppSection';
import { LeadsSection } from './LeadsSection';
import { FunnelSection } from './FunnelSection';
import { FinancialSection } from './FinancialSection';
import { AutomationSection } from './AutomationSection';
import { AgentPerformanceSection } from './AgentPerformanceSection';
import { AlertsSection } from './AlertsSection';

export const TraditionalDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  return (
    <div className="space-y-6">
      {/* Header com título e filtro */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão completa de performance</p>
        </div>
        <DashboardDateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Visão Geral */}
      <OverviewSection dateRange={dateRange} />

      {/* WhatsApp + Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WhatsAppSection dateRange={dateRange} />
        <LeadsSection dateRange={dateRange} />
      </div>

      {/* Funil/CRM */}
      <FunnelSection dateRange={dateRange} />

      {/* Financeiro + Automação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialSection dateRange={dateRange} />
        <AutomationSection dateRange={dateRange} />
      </div>

      {/* Atendimento + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentPerformanceSection dateRange={dateRange} />
        <AlertsSection />
      </div>
    </div>
  );
};
