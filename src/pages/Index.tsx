import { Package, Truck, Route, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';

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
    const styles = {
      draft: 'bg-muted text-muted-foreground',
      planned: 'bg-primary/10 text-primary',
      completed: 'bg-success/10 text-success',
    };
    const labels = {
      draft: 'Rascunho',
      planned: 'Planejada',
      completed: 'Concluída',
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loadingTrucks || loadingRoutes) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do sistema de roteirização</p>
          </div>
          <Button asChild>
            <Link to="/nova-rota">
              <Route className="mr-2 h-4 w-4" />
              Nova Rota
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Peso Total Hoje"
            value={formatWeight(totalWeightToday)}
            subtitle={`${totalOrdersToday} pedidos`}
            icon={<Package className="h-5 w-5" />}
            variant="primary"
          />
          <StatsCard
            title="Caminhões Disponíveis"
            value={activeTrucks.length}
            subtitle={`Capacidade: ${formatWeight(totalCapacity)}`}
            icon={<Truck className="h-5 w-5" />}
            variant="success"
          />
          <StatsCard
            title="Rotas Hoje"
            value={todayRoutes.length}
            subtitle={`${trucksUsedToday} caminhões em uso`}
            icon={<Route className="h-5 w-5" />}
            variant="default"
          />
          <StatsCard
            title="Rotas no Histórico"
            value={routes.length}
            subtitle="Total de rotas salvas"
            icon={<Clock className="h-5 w-5" />}
            variant="default"
          />
        </div>

        {/* Recent Routes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Rotas Recentes</CardTitle>
              <CardDescription>Últimas rotas criadas</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/historico">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentRoutes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Route className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>Nenhuma rota criada ainda</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/nova-rota">Criar primeira rota</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRoutes.map((route) => (
                  <Link
                    key={route.id}
                    to={`/rota/${route.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{route.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(route.status)}
                      <span className="text-sm text-muted-foreground">{formatDate(route.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {activeTrucks.length === 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Cadastre sua frota</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione caminhões para começar a criar rotas
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/frota">Cadastrar Frota</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
