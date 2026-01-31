import { Package, Truck, Route, Clock, ArrowRight, Plus, Activity, MapPin, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FuturisticStatsCard } from '@/components/dashboard/FuturisticStatsCard';
import { AbstractRouteVisualization } from '@/components/dashboard/AbstractRouteVisualization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { cn } from '@/lib/utils';

export default function Index() {
  const { activeTrucks, totalCapacity, isLoading: loadingTrucks } = useTrucks();
  const { routes, isLoading: loadingRoutes } = useRoutes();

  const todayRoutes = routes.filter((r) => {
    const today = new Date().toDateString();
    return new Date(r.created_at).toDateString() === today;
  });

  const totalOrdersToday = todayRoutes.reduce((sum, r) => sum + r.total_orders, 0);
  const totalWeightToday = todayRoutes.reduce((sum, r) => sum + Number(r.total_weight_kg), 0);
  const trucksUsedToday = new Set(todayRoutes.flatMap((r) => r.id)).size;

  const recentRoutes = routes.slice(0, 5);

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTodayDate = () => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    const config = {
      draft: { label: 'Rascunho', variant: 'secondary' as const, color: 'bg-muted' },
      planned: { label: 'Planejada', variant: 'default' as const, color: 'bg-primary' },
      trucks_assigned: { label: 'Em Processo', variant: 'default' as const, color: 'bg-info' },
      loading: { label: 'Carregando', variant: 'default' as const, color: 'bg-warning' },
      loading_confirmed: { label: 'Confirmada', variant: 'default' as const, color: 'bg-success' },
      distributed: { label: 'Distribuída', variant: 'default' as const, color: 'bg-success' },
      completed: { label: 'Concluída', variant: 'outline' as const, color: 'bg-muted-foreground' },
    };
    return config[status as keyof typeof config] || config.draft;
  };

  if (loadingTrucks || loadingRoutes) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Carregando dados operacionais...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Header - Futuristic */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
          {/* Background effects */}
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />
          <div className="absolute inset-0 bg-radial-gradient" />
          
          {/* Animated accent lines */}
          <div className="absolute left-0 top-1/2 h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-accent/30 to-transparent opacity-50" />

          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/80">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Centro de Controle</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Operação de Entregas
              </h1>
              <p className="flex items-center gap-2 text-slate-400">
                <Clock className="h-4 w-4" />
                <span className="capitalize">{getTodayDate()}</span>
              </p>
            </div>

            {/* Operation Status */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 rounded-full border border-success/30 bg-success/10 px-4 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                <span className="text-sm font-medium text-success">Sistema Operacional</span>
              </div>
              
              <Button asChild size="lg" className="group shadow-lg hover:shadow-primary/25">
                <Link to="/nova-rota">
                  <Zap className="mr-2 h-5 w-5" />
                  Nova Rota
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats preview */}
          <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Entregas Hoje', value: totalOrdersToday, icon: Package },
              { label: 'Peso Total', value: formatWeight(totalWeightToday), icon: Truck },
              { label: 'Rotas Ativas', value: todayRoutes.length, icon: Route },
              { label: 'Frota Disponível', value: activeTrucks.length, icon: Truck },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-2 text-slate-400">
                  <stat.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FuturisticStatsCard
            title="Peso Total Processado"
            value={formatWeight(totalWeightToday)}
            subtitle={`${totalOrdersToday} pedidos hoje`}
            icon={<Package className="h-7 w-7" />}
            variant="primary"
            delay={100}
          />
          <FuturisticStatsCard
            title="Frota Disponível"
            value={activeTrucks.length}
            subtitle={`Capacidade: ${formatWeight(totalCapacity)}`}
            icon={<Truck className="h-7 w-7" />}
            variant="success"
            delay={200}
          />
          <FuturisticStatsCard
            title="Rotas do Dia"
            value={todayRoutes.length}
            subtitle={`${trucksUsedToday} veículos alocados`}
            icon={<Route className="h-7 w-7" />}
            variant="info"
            delay={300}
          />
          <FuturisticStatsCard
            title="Histórico Total"
            value={routes.length}
            subtitle="Rotas registradas"
            icon={<Clock className="h-7 w-7" />}
            variant="default"
            delay={400}
          />
        </div>

        {/* Route Visualization & Recent Routes */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Abstract Route Visualization */}
          <Card className="lg:col-span-2 overflow-hidden border-0 shadow-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                Visualização de Rotas
              </CardTitle>
              <CardDescription>Fluxo abstrato das operações</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <AbstractRouteVisualization className="h-[280px]" animated />
            </CardContent>
          </Card>

          {/* Recent Routes */}
          <Card className="lg:col-span-3 shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-semibold">Rotas Recentes</CardTitle>
                <CardDescription>Últimas operações registradas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
                <Link to="/historico">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10">
                    <Route className="h-10 w-10 text-primary" />
                  </div>
                  <p className="font-semibold">Nenhuma rota criada</p>
                  <p className="mb-6 mt-1 text-sm text-muted-foreground">
                    Comece criando sua primeira rota de entregas
                  </p>
                  <Button asChild className="gap-2">
                    <Link to="/nova-rota">
                      <Plus className="h-4 w-4" />
                      Criar primeira rota
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRoutes.map((route, index) => {
                    const statusConfig = getStatusConfig(route.status);
                    return (
                      <Link
                        key={route.id}
                        to={`/rota/${route.id}`}
                        className={cn(
                          "group relative flex items-center justify-between rounded-xl border border-transparent p-4 transition-all duration-300",
                          "hover:border-border hover:bg-muted/50 hover:shadow-sm",
                          "opacity-0 animate-slide-in-bottom"
                        )}
                        style={{ 
                          animationDelay: `${(index + 1) * 100}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        {/* Status indicator line */}
                        <div className={cn(
                          "absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-all duration-300",
                          "opacity-0 group-hover:opacity-100",
                          statusConfig.color
                        )} />

                        <div className="min-w-0 flex-1 pl-2">
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">{route.name}</p>
                            <Badge variant={statusConfig.variant} className="text-xs">
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(route.created_at)}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Fleet Status */}
          <Card className="shadow-soft hover-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                  <Truck className="h-4 w-4 text-success" />
                </div>
                Status da Frota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Veículos ativos</span>
                  <span className="font-bold">{activeTrucks.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacidade total</span>
                  <span className="font-bold">{formatWeight(totalCapacity)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/frota">Gerenciar Frota</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-soft hover-glow transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="secondary" size="sm" asChild className="justify-start gap-2">
                <Link to="/nova-rota">
                  <Route className="h-4 w-4" />
                  Nova Roteirização
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild className="justify-start gap-2">
                <Link to="/historico">
                  <Clock className="h-4 w-4" />
                  Ver Histórico
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* No Fleet Warning or Performance */}
          {activeTrucks.length === 0 ? (
            <Card className="border-warning/30 bg-warning/5 shadow-soft lg:col-span-2">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Truck className="h-7 w-7 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Configure sua Frota</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre seus caminhões para começar a roteirização inteligente
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <Link to="/frota">Cadastrar Veículos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-soft hover-glow transition-all duration-300 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                    <Activity className="h-4 w-4 text-info" />
                  </div>
                  Performance do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{routes.length}</p>
                    <p className="text-xs text-muted-foreground">Rotas Totais</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{activeTrucks.length}</p>
                    <p className="text-xs text-muted-foreground">Veículos Ativos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-info">100%</p>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
