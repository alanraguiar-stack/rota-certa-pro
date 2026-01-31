import { Package, Truck, Route, Clock, ArrowRight, Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
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

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { label: 'Rascunho', variant: 'secondary' as const },
      planned: { label: 'Planejada', variant: 'default' as const },
      trucks_assigned: { label: 'Em Processo', variant: 'default' as const },
      loading: { label: 'Carregando', variant: 'default' as const },
      loading_confirmed: { label: 'Confirmada', variant: 'default' as const },
      distributed: { label: 'Distribuída', variant: 'default' as const },
      completed: { label: 'Concluída', variant: 'outline' as const },
    };
    const statusConfig = config[status as keyof typeof config] || config.draft;
    
    return (
      <Badge variant={statusConfig.variant} className="font-medium">
        {statusConfig.label}
      </Badge>
    );
  };

  if (loadingTrucks || loadingRoutes) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Carregando...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Acompanhe suas operações logísticas em tempo real
            </p>
          </div>
          <Button asChild size="lg" className="group shadow-soft">
            <Link to="/nova-rota">
              <Plus className="mr-2 h-5 w-5" />
              Nova Rota
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Peso Total Hoje"
            value={formatWeight(totalWeightToday)}
            subtitle={`${totalOrdersToday} pedidos processados`}
            icon={<Package className="h-6 w-6" />}
            variant="primary"
          />
          <StatsCard
            title="Frota Disponível"
            value={activeTrucks.length}
            subtitle={`Capacidade: ${formatWeight(totalCapacity)}`}
            icon={<Truck className="h-6 w-6" />}
            variant="success"
          />
          <StatsCard
            title="Rotas Hoje"
            value={todayRoutes.length}
            subtitle={`${trucksUsedToday} veículos em operação`}
            icon={<Route className="h-6 w-6" />}
            variant="info"
          />
          <StatsCard
            title="Total de Rotas"
            value={routes.length}
            subtitle="Histórico completo"
            icon={<Clock className="h-6 w-6" />}
            variant="default"
          />
        </div>

        {/* Quick Actions & Recent Routes */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Routes */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-semibold">Rotas Recentes</CardTitle>
                <CardDescription>Últimas rotas criadas no sistema</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link to="/historico">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Route className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">Nenhuma rota criada</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Comece criando sua primeira rota de entregas
                  </p>
                  <Button asChild>
                    <Link to="/nova-rota">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar primeira rota
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRoutes.map((route, index) => (
                    <Link
                      key={route.id}
                      to={`/rota/${route.id}`}
                      className={cn(
                        "group flex items-center justify-between rounded-lg border border-transparent p-4 transition-all",
                        "hover:border-border hover:bg-muted/50 hover:shadow-sm"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{route.name}</p>
                          {getStatusBadge(route.status)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(route.created_at)}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            {/* Fleet Status */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Truck className="h-5 w-5 text-success" />
                  Status da Frota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Veículos ativos</span>
                  <span className="font-semibold">{activeTrucks.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Capacidade total</span>
                  <span className="font-semibold">{formatWeight(totalCapacity)}</span>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/frota">Gerenciar Frota</Link>
                </Button>
              </CardContent>
            </Card>

            {/* No Fleet Warning */}
            {activeTrucks.length === 0 && (
              <Card className="border-warning/30 bg-warning/5 shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                      <Truck className="h-5 w-5 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Cadastre sua frota</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adicione caminhões para começar a roteirizar
                      </p>
                      <Button variant="outline" size="sm" asChild className="mt-3">
                        <Link to="/frota">Cadastrar Veículos</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="secondary" size="sm" asChild className="justify-start">
                  <Link to="/nova-rota">
                    <Route className="mr-2 h-4 w-4" />
                    Nova Roteirização
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" asChild className="justify-start">
                  <Link to="/historico">
                    <Clock className="mr-2 h-4 w-4" />
                    Ver Histórico
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" asChild className="justify-start">
                  <Link to="/frota">
                    <Truck className="mr-2 h-4 w-4" />
                    Gerenciar Frota
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
