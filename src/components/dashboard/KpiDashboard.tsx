import { Package, Weight, Gauge, CheckCircle2, MapPin } from 'lucide-react';
import { FuturisticStatsCard } from './FuturisticStatsCard';
import { useKpiMetrics, KpiPeriod } from '@/hooks/useKpiMetrics';
import { cn } from '@/lib/utils';

const periodLabels: Record<KpiPeriod, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
};

const trendLabel: Record<KpiPeriod, string> = {
  today: 'vs ontem',
  '7d': 'vs semana anterior',
  '30d': 'vs mês anterior',
};

function formatWeight(weight: number) {
  if (weight >= 1000) return `${(weight / 1000).toFixed(1)}t`;
  return `${weight.toFixed(0)}kg`;
}

export function KpiDashboard() {
  const { metrics, period, setPeriod, isLoading } = useKpiMetrics();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">KPIs Operacionais</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">KPIs Operacionais</h2>
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          {(Object.keys(periodLabels) as KpiPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FuturisticStatsCard
          title="Pedidos"
          value={metrics.totalOrders}
          icon={<Package className="h-6 w-6" />}
          variant="primary"
          trend={{ value: metrics.ordersTrend, label: trendLabel[period] }}
          delay={50}
        />
        <FuturisticStatsCard
          title="Peso Movimentado"
          value={formatWeight(metrics.totalWeight)}
          icon={<Weight className="h-6 w-6" />}
          variant="info"
          trend={{ value: metrics.weightTrend, label: trendLabel[period] }}
          delay={100}
        />
        <FuturisticStatsCard
          title="Ocupação Média"
          value={`${metrics.occupancy}%`}
          subtitle="Capacidade utilizada"
          icon={<Gauge className="h-6 w-6" />}
          variant="warning"
          delay={150}
        />
        <FuturisticStatsCard
          title="Entregas Concluídas"
          value={`${metrics.completionRate}%`}
          subtitle={`${metrics.completedDeliveries}/${metrics.totalDeliveries}`}
          icon={<CheckCircle2 className="h-6 w-6" />}
          variant="success"
          delay={200}
        />
        <FuturisticStatsCard
          title="Cidades Atendidas"
          value={metrics.citiesServed}
          icon={<MapPin className="h-6 w-6" />}
          variant="default"
          delay={250}
        />
      </div>
    </div>
  );
}
