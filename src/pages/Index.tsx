import { Package, Truck, Route, Clock, ArrowRight, Plus, Activity, MapPin, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrucks } from '@/hooks/useTrucks';
import { useRoutes } from '@/hooks/useRoutes';
import { cn } from '@/lib/utils';

// Modern Stats Card Component
function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = 'default',
  delay = 0 
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  icon: React.ElementType;
  variant?: 'default' | 'accent' | 'success' | 'info' | 'warning';
  delay?: number;
}) {
  const variants = {
    default: {
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      accentBg: 'from-primary/5 to-transparent',
    },
    accent: {
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      accentBg: 'from-accent/5 to-transparent',
    },
    success: {
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      accentBg: 'from-success/5 to-transparent',
    },
    info: {
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
      accentBg: 'from-info/5 to-transparent',
    },
    warning: {
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      accentBg: 'from-warning/5 to-transparent',
    },
  };

  const v = variants[variant];

  return (
    <Card 
      className="group relative overflow-hidden border shadow-soft hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {/* Accent gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", v.accentBg)} />
      
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-r-full transition-all duration-300", v.iconBg, "group-hover:w-1.5")} />
      
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110", v.iconBg)}>
            <Icon className={cn("h-7 w-7", v.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Abstract Route Visualization
function RouteVisualization() {
  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-info/5">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50" />
      
      {/* SVG Routes */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="routeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(168, 76%, 42%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(192, 91%, 48%)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="routeGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(24, 95%, 58%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(168, 76%, 42%)" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        {/* Animated paths */}
        <path
          d="M20,150 Q100,80 180,120 T300,100 T380,150"
          fill="none"
          stroke="url(#routeGrad1)"
          strokeWidth="3"
          strokeDasharray="8 4"
          className="animate-path-draw"
        />
        <path
          d="M20,200 Q80,160 160,180 T280,160 T380,200"
          fill="none"
          stroke="url(#routeGrad2)"
          strokeWidth="2"
          strokeDasharray="6 3"
          className="animate-path-draw"
          style={{ animationDelay: '0.5s' }}
        />
        
        {/* Nodes */}
        {[
          { cx: 50, cy: 140, r: 6 },
          { cx: 140, cy: 110, r: 8 },
          { cx: 220, cy: 125, r: 6 },
          { cx: 300, cy: 95, r: 7 },
          { cx: 360, cy: 145, r: 6 },
          { cx: 100, cy: 185, r: 5 },
          { cx: 200, cy: 170, r: 6 },
          { cx: 320, cy: 175, r: 5 },
        ].map((node, i) => (
          <g key={i}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r + 4}
              fill="hsl(168, 76%, 42%)"
              opacity="0.2"
              className="animate-dot-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill="hsl(168, 76%, 50%)"
              className="animate-dot-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          </g>
        ))}
      </svg>
      
      {/* Floating label */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 shadow-soft backdrop-blur-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-sm font-medium">Rotas em tempo real</span>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const { activeTrucks, totalCapacity, isLoading: loadingTrucks } = useTrucks();
  const { routes, isLoading: loadingRoutes } = useRoutes();

  const todayRoutes = routes.filter((r) => {
    const today = new Date().toDateString();
    return new Date(r.created_at).toDateString() === today;
  });

  const totalOrdersToday = todayRoutes.reduce((sum, r) => sum + r.total_orders, 0);
  const totalWeightToday = todayRoutes.reduce((sum, r) => sum + Number(r.total_weight_kg), 0);

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
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Carregando dados operacionais...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-8 text-primary-foreground shadow-elevated">
          {/* Background effects */}
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cta/15 blur-3xl" />
          
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Activity className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold uppercase tracking-wider text-white/70">Centro de Controle</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Painel de Operações
              </h1>
              <p className="flex items-center gap-2 text-lg text-white/70">
                <Clock className="h-5 w-5" />
                <span className="capitalize">{getTodayDate()}</span>
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex flex-col items-start gap-4 sm:items-end">
              <div className="hidden sm:flex items-center gap-3 rounded-full bg-white/10 px-5 py-2.5 backdrop-blur-sm">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
                <span className="text-sm font-semibold">Sistema Operacional</span>
              </div>
              
              <Button 
                asChild 
                size="lg" 
                className="group h-14 bg-gradient-to-r from-cta to-warning px-8 text-lg font-semibold shadow-glow-cta hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <Link to="/nova-rota">
                  <Zap className="mr-2 h-6 w-6" />
                  Nova Rota
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Entregas Hoje"
            value={totalOrdersToday}
            subtitle={`${todayRoutes.length} rotas criadas`}
            icon={Package}
            variant="accent"
            delay={100}
          />
          <StatsCard
            title="Peso Total"
            value={formatWeight(totalWeightToday)}
            subtitle="Processado hoje"
            icon={TrendingUp}
            variant="info"
            delay={200}
          />
          <StatsCard
            title="Frota Disponível"
            value={activeTrucks.length}
            subtitle={`Capacidade: ${formatWeight(totalCapacity)}`}
            icon={Truck}
            variant="success"
            delay={300}
          />
          <StatsCard
            title="Rotas Totais"
            value={routes.length}
            subtitle="No sistema"
            icon={Route}
            variant="default"
            delay={400}
          />
        </div>

        {/* Route Visualization & Recent Routes */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Abstract Route Visualization */}
          <Card className="lg:col-span-2 overflow-hidden border-0 shadow-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <MapPin className="h-5 w-5 text-accent" />
                </div>
                Visualização de Rotas
              </CardTitle>
              <CardDescription>Fluxo abstrato das operações</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <RouteVisualization />
            </CardContent>
          </Card>

          {/* Recent Routes */}
          <Card className="lg:col-span-3 shadow-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-semibold">Rotas Recentes</CardTitle>
                <CardDescription>Últimas operações registradas</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-accent hover:text-accent/80">
                <Link to="/historico">
                  Ver todas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/10 to-info/10">
                    <Route className="h-12 w-12 text-accent" />
                  </div>
                  <p className="text-lg font-semibold">Nenhuma rota criada</p>
                  <p className="mb-6 mt-2 text-sm text-muted-foreground">
                    Comece criando sua primeira rota de entregas
                  </p>
                  <Button asChild className="gap-2 bg-gradient-to-r from-cta to-warning">
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
                          "group relative flex items-center justify-between rounded-2xl border border-transparent p-4 transition-all duration-300",
                          "hover:border-border hover:bg-accent/5 hover:shadow-soft",
                          "opacity-0 animate-slide-in-bottom"
                        )}
                        style={{ 
                          animationDelay: `${(index + 1) * 80}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        {/* Status indicator */}
                        <div className={cn(
                          "absolute left-0 top-1/2 h-10 w-1.5 -translate-y-1/2 rounded-full transition-all duration-300",
                          "opacity-0 group-hover:opacity-100",
                          statusConfig.color
                        )} />

                        <div className="min-w-0 flex-1 pl-2">
                          <div className="flex items-center gap-3">
                            <p className="font-semibold">{route.name}</p>
                            <Badge variant={statusConfig.variant} className="text-xs font-medium">
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Fleet Status */}
          <Card className="shadow-soft hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-base font-semibold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <Truck className="h-5 w-5 text-success" />
                </div>
                Status da Frota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Veículos ativos</span>
                  <span className="text-lg font-bold">{activeTrucks.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacidade total</span>
                  <span className="text-lg font-bold">{formatWeight(totalCapacity)}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/frota">Gerenciar Frota</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-soft hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-base font-semibold">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Zap className="h-5 w-5 text-accent" />
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
              <CardContent className="flex items-center gap-5 p-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-warning/10">
                  <Truck className="h-8 w-8 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">Configure sua Frota</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre seus caminhões para começar a roteirização inteligente
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-4">
                    <Link to="/frota">Cadastrar Veículos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-soft hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5 lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-semibold">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                    <Activity className="h-5 w-5 text-info" />
                  </div>
                  Performance do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-accent">{routes.length}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Rotas Totais</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-success">{activeTrucks.length}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Veículos Ativos</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-6 w-6 text-success" />
                      <p className="text-3xl font-bold text-success">100%</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Uptime</p>
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
