import { Link } from 'react-router-dom';
import { Route, Trash2, Search, Plus } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRoutes } from '@/hooks/useRoutes';
import { usePageTitle } from '@/hooks/usePageTitle';
import { RouteStatusBadge } from '@/components/ui/RouteStatusBadge';

export default function History() {
  const { routes, isLoading, deleteRoute } = useRoutes();
  const [search, setSearch] = useState('');
  usePageTitle('Histórico');

  const filteredRoutes = routes.filter((route) =>
    route.name.toLowerCase().includes(search.toLowerCase())
  );

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };



  const handleDelete = (id: string) => {
    deleteRoute.mutate(id);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Carregando histórico...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Rotas</h1>
            <p className="text-muted-foreground">{routes.length} rotas no total</p>
          </div>
          <Button asChild>
            <Link to="/nova-rota">
              <Route className="mr-2 h-4 w-4" />
              Nova Rota
            </Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar rotas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {routes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Route className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold">Nenhuma rota no histórico</h3>
              <p className="mt-2 mb-6 max-w-sm text-sm text-muted-foreground">
                Suas rotas criadas aparecem aqui. Comece criando a primeira rota de entregas.
              </p>
              <Button asChild>
                <Link to="/nova-rota">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Rota
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredRoutes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Search className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <h3 className="font-semibold">Nenhuma rota encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Nenhum resultado para <span className="font-medium">"{search}"</span>. Tente outro nome.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Rotas</CardTitle>
              <CardDescription>
                {filteredRoutes.length} {filteredRoutes.length === 1 ? 'rota encontrada' : 'rotas encontradas'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <Link to={`/rota/${route.id}`} className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Route className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{route.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))} •{' '}
                            {formatDate(route.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3">
                      <RouteStatusBadge status={route.status} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover rota?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A rota "{route.name}" será removida permanentemente junto com todos os seus pedidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(route.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
