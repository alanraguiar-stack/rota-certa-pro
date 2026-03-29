import { Truck, Route, Clock, ArrowRight, Plus, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { cn } from '@/lib/utils';
import { KpiDashboard } from '@/components/dashboard/KpiDashboard';

export default function Index() {
  const { activeTrucks, totalCapacity, isLoading: loadingTrucks } = useTrucks();
  const { routes, isLoading: loadingRoutes } = useRoutes();

  const recentRoutes = routes.slice(0, 5);

  const formatWeight = (weight: number) => {
    if (weight >= 1000) return `${(weight / 1000).toFixed(1)}t`;
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
      draft: { label: 'Rascunho', variant: 'secondary' as const },
      planned: { label: 'Planejada', variant: 'default' as const },
      trucks_assigned: { label: 'Em Processo', variant: 'default' as const },
      loading: { label: 'Carregando', variant: 'default' as const },
      loading_confirmed: { label: 'Confirmada', variant: 'default' as const },
      distributed: { label: 'Distribuída', variant: 'default' as const },
      completed: { label: 'Concluída', variant: 'outline' as const },
    };
    return config[status as keyof typeof config] || config.draft;
  };

  if (loadingTrucks || loadingRoutes) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel de Operações</h1>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="capitalize">{getTodayDate()}</span>
            </p>
          </div>
          <Button asChild size="lg" className="h-11 px-6 font-semibold">
            <Link to="/nova-rota">
              <Plus className="mr-2 h-4 w-4" />
              Nova Rota
            </Link>
          </Button>
        </div>

        {/* KPI Dashboard */}
        <KpiDashboard />

        {/* Recent Routes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Rotas Recentes</CardTitle>
              <CardDescription>Últimas operações registradas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary">
              <Link to="/historico">
                Ver todas
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentRoutes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Route className="mb-4 h-10 w-10 text-muted-foreground/40" />
                <p className="font-semibold">Nenhuma rota criada</p>
                <p className="mb-5 mt-1 text-sm text-muted-foreground">
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
              <div className="space-y-1">
                {recentRoutes.map((route, index) => {
                  const statusConfig = getStatusConfig(route.status);
                  return (
                    <Link
                      key={route.id}
                      to={`/rota/${route.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg p-3 gap-1 sm:gap-3 transition-colors duration-150 hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{route.name}</p>
                          <Badge variant={statusConfig.variant} className="text-xs">
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs sm:text-sm text-muted-foreground">{formatDate(route.created_at)}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Fleet Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Status da Frota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Veículos ativos</span>
                <span className="font-semibold">{activeTrucks.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Capacidade total</span>
                <span className="font-semibold">{formatWeight(totalCapacity)}</span>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/frota">Gerenciar Frota</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5">
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

          {/* Fleet Warning or Performance */}
          {activeTrucks.length === 0 ? (
            <Card className="border-warning/30 sm:col-span-2">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Truck className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="font-semibold">Configure sua Frota</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Cadastre seus caminhões para começar
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <Link to="/frota">Cadastrar Veículos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="sm:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{routes.length}</p>
                    <p className="text-xs text-muted-foreground">Rotas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{activeTrucks.length}</p>
                    <p className="text-xs text-muted-foreground">Veículos</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <p className="text-2xl font-bold text-success">100%</p>
                    </div>
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
