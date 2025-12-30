import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MyPermissionsCard } from "@/components/settings/MyPermissionsCard";
import { DashboardDateFilter } from "@/components/dashboard/DashboardDateFilter";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { WhatsAppSection } from "@/components/dashboard/WhatsAppSection";
import { LeadsSection } from "@/components/dashboard/LeadsSection";
import { FunnelSection } from "@/components/dashboard/FunnelSection";
import { AutomationSection } from "@/components/dashboard/AutomationSection";
import { AgentPerformanceSection } from "@/components/dashboard/AgentPerformanceSection";
import { FinancialSection } from "@/components/dashboard/FinancialSection";
import { AlertsSection } from "@/components/dashboard/AlertsSection";
import { ChaosControlSection } from "@/components/dashboard/ChaosControlSection";
import { SLAByMemberChart } from "@/components/dashboard/SLAByMemberChart";
import { ResponseQueueList } from "@/components/dashboard/ResponseQueueList";
import { DealsWithoutActionList } from "@/components/dashboard/DealsWithoutActionList";
import { type DateRange } from "@/hooks/useDashboardMetricsV2";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  return (
    <DashboardLayout className="p-4 md:p-8">
      <MyPermissionsCard />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Dashboard CRM/SDR
          </h1>
          <p className="text-muted-foreground">
            Visão 360° de leads, atendimento, vendas e automação
          </p>
        </div>
        <DashboardDateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* 🚨 Controle do Caos - PRIORIDADE */}
      <div className="mb-6">
        <ChaosControlSection />
      </div>

      {/* 📊 SLA + Filas - Visibilidade de Gargalos */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <SLAByMemberChart />
        <ResponseQueueList />
        <DealsWithoutActionList />
      </div>

      {/* 📊 Visão Geral */}
      <div className="mb-6">
        <OverviewSection dateRange={dateRange} />
      </div>

      {/* 💬 WhatsApp + 👥 Leads */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <WhatsAppSection dateRange={dateRange} />
        <LeadsSection dateRange={dateRange} />
      </div>

      {/* 🔄 Funil/CRM */}
      <div className="mb-6">
        <FunnelSection dateRange={dateRange} />
      </div>

      {/* 🤖 Automação + 🧍 Atendimento Humano */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <AutomationSection dateRange={dateRange} />
        <AgentPerformanceSection dateRange={dateRange} />
      </div>

      {/* 💰 Financeiro + 🚨 Alertas */}
      <div className="grid lg:grid-cols-2 gap-6">
        <FinancialSection dateRange={dateRange} />
        <AlertsSection />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
