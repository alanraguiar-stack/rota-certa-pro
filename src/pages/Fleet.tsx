import { useState } from 'react';
import { Plus, Pencil, Trash2, Truck as TruckIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTrucks } from '@/hooks/useTrucks';
import { TruckFormData, Truck } from '@/types';
import { cn } from '@/lib/utils';

function TruckForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: Truck;
  onSubmit: (data: TruckFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [plate, setPlate] = useState(initialData?.plate ?? '');
  const [model, setModel] = useState(initialData?.model ?? '');
  const [capacityKg, setCapacityKg] = useState(initialData?.capacity_kg?.toString() ?? '');
  const [maxDeliveries, setMaxDeliveries] = useState(initialData?.max_deliveries?.toString() ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      plate,
      model,
      capacity_kg: parseFloat(capacityKg),
      max_deliveries: maxDeliveries ? parseInt(maxDeliveries) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="plate">Placa *</Label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="ABC-1234"
          required
          className="uppercase"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Modelo *</Label>
        <Input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Ex: VW 11.180"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="capacity">Capacidade Máxima (kg) *</Label>
        <Input
          id="capacity"
          type="number"
          value={capacityKg}
          onChange={(e) => setCapacityKg(e.target.value)}
          placeholder="Ex: 5000"
          min="1"
          step="0.01"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maxDeliveries">Máximo de Entregas (opcional)</Label>
        <Input
          id="maxDeliveries"
          type="number"
          value={maxDeliveries}
          onChange={(e) => setMaxDeliveries(e.target.value)}
          placeholder="Ex: 20"
          min="1"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Salvando...' : initialData ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Fleet() {
  const { trucks, activeTrucks, totalCapacity, isLoading, createTruck, updateTruck, deleteTruck } =
    useTrucks();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);

  const handleCreate = (data: TruckFormData) => {
    createTruck.mutate(data, {
      onSuccess: () => setIsDialogOpen(false),
    });
  };

  const handleUpdate = (data: TruckFormData) => {
    if (!editingTruck) return;
    updateTruck.mutate(
      { id: editingTruck.id, data },
      {
        onSuccess: () => {
          setEditingTruck(null);
          setIsDialogOpen(false);
        },
      }
    );
  };

  const handleToggleActive = (truck: Truck) => {
    updateTruck.mutate({
      id: truck.id,
      data: { is_active: !truck.is_active },
    });
  };

  const handleDelete = (id: string) => {
    deleteTruck.mutate(id);
  };

  const openCreateDialog = () => {
    setEditingTruck(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (truck: Truck) => {
    setEditingTruck(truck);
    setIsDialogOpen(true);
  };

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Carregando frota...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Frota</h1>
            <p className="text-muted-foreground">
              {activeTrucks.length} caminhões ativos • Capacidade total: {formatWeight(totalCapacity)}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Caminhão
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTruck ? 'Editar Caminhão' : 'Novo Caminhão'}</DialogTitle>
                <DialogDescription>
                  {editingTruck
                    ? 'Atualize as informações do caminhão'
                    : 'Preencha os dados do caminhão para cadastrá-lo na frota'}
                </DialogDescription>
              </DialogHeader>
              <TruckForm
                initialData={editingTruck ?? undefined}
                onSubmit={editingTruck ? handleUpdate : handleCreate}
                onCancel={() => setIsDialogOpen(false)}
                isLoading={createTruck.isPending || updateTruck.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {trucks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TruckIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium">Nenhum caminhão cadastrado</h3>
              <p className="mb-4 text-center text-muted-foreground">
                Cadastre os caminhões da sua frota para começar a criar rotas
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Primeiro Caminhão
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truck) => (
              <Card
                key={truck.id}
                className={cn('transition-all', !truck.is_active && 'opacity-60')}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <TruckIcon className="h-5 w-5 text-primary" />
                        {truck.plate}
                      </CardTitle>
                      <CardDescription>{truck.model}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={truck.is_active}
                        onCheckedChange={() => handleToggleActive(truck)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacidade:</span>
                      <span className="font-medium">{formatWeight(Number(truck.capacity_kg))}</span>
                    </div>
                    {truck.max_deliveries && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Máx. entregas:</span>
                        <span className="font-medium">{truck.max_deliveries}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span
                        className={cn(
                          'font-medium',
                          truck.is_active ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        {truck.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(truck)}
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover caminhão?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O caminhão {truck.plate} será removido permanentemente. Esta ação não
                            pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(truck.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
