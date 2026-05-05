import { useState } from 'react';
import { Plus, Pencil, Trash2, Truck as TruckIcon, Eye, Calendar, Car, FileText, Hash } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTrucks } from '@/hooks/useTrucks';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUserRole } from '@/hooks/useUserRole';
import { TruckFormData, Truck } from '@/types';
import { validateBrazilianPlate, formatPlateInput } from '@/lib/plateValidation';
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
  const [plateError, setPlateError] = useState<string | null>(null);
  const [model, setModel] = useState(initialData?.model ?? '');
  const [capacityKg, setCapacityKg] = useState(initialData?.capacity_kg?.toString() ?? '');
  const [maxDeliveries, setMaxDeliveries] = useState(initialData?.max_deliveries?.toString() ?? '');
  const [marca, setMarca] = useState(initialData?.marca ?? '');
  const [ano, setAno] = useState(initialData?.ano?.toString() ?? '');
  const [renavam, setRenavam] = useState(initialData?.renavam ?? '');
  const [observacoes, setObservacoes] = useState(initialData?.observacoes ?? '');

  const handlePlateChange = (value: string) => {
    const formatted = formatPlateInput(value);
    setPlate(formatted);
    
    if (formatted.length >= 7) {
      const validation = validateBrazilianPlate(formatted);
      setPlateError(validation.valid ? null : validation.error ?? null);
    } else {
      setPlateError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateBrazilianPlate(plate);
    if (!validation.valid) {
      setPlateError(validation.error ?? 'Placa inválida');
      return;
    }

    onSubmit({
      plate: validation.formatted,
      model,
      capacity_kg: parseFloat(capacityKg),
      max_deliveries: maxDeliveries ? parseInt(maxDeliveries) : undefined,
      marca: marca || undefined,
      ano: ano ? parseInt(ano) : undefined,
      renavam: renavam || undefined,
      observacoes: observacoes || undefined,
    });
  };

  const currentYear = new Date().getFullYear();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Identification */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Hash className="h-4 w-4 text-primary" />
          Identificação
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plate">Placa *</Label>
            <Input
              id="plate"
              value={plate}
              onChange={(e) => handlePlateChange(e.target.value)}
              placeholder="ABC-1234 ou ABC1D23"
              required
              className={cn('uppercase', plateError && 'border-destructive')}
            />
            {plateError && (
              <p className="text-xs text-destructive">{plateError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="renavam">RENAVAM</Label>
            <Input
              id="renavam"
              value={renavam}
              onChange={(e) => setRenavam(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="00000000000"
              maxLength={11}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section: Capacity */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TruckIcon className="h-4 w-4 text-primary" />
          Capacidade
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="maxDeliveries">Máximo de Entregas</Label>
            <Input
              id="maxDeliveries"
              type="number"
              value={maxDeliveries}
              onChange={(e) => setMaxDeliveries(e.target.value)}
              placeholder="Ex: 20"
              min="1"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section: Vehicle Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Car className="h-4 w-4 text-primary" />
          Detalhes do Veículo
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="marca">Marca</Label>
            <Input
              id="marca"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ex: Volkswagen"
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
            <Label htmlFor="ano">Ano</Label>
            <Input
              id="ano"
              type="number"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              placeholder="Ex: 2023"
              min="1950"
              max={currentYear + 1}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Section: Notes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Observações
        </div>
        <div className="space-y-2">
          <Textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Informações adicionais sobre o veículo..."
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !!plateError}>
          {isLoading ? 'Salvando...' : initialData ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TruckDetailsDialog({ truck }: { truck: Truck }) {
  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-primary" />
          {truck.plate}
        </DialogTitle>
        <DialogDescription>Detalhes completos do veículo</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Status:</span>
            <Badge 
              variant={truck.is_active ? "default" : "secondary"} 
              className="ml-2"
            >
              {truck.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Capacidade:</span>
            <span className="ml-2 font-medium">{formatWeight(Number(truck.capacity_kg))}</span>
          </div>
          {truck.max_deliveries && (
            <div>
              <span className="text-muted-foreground">Máx. Entregas:</span>
              <span className="ml-2 font-medium">{truck.max_deliveries}</span>
            </div>
          )}
          {truck.marca && (
            <div>
              <span className="text-muted-foreground">Marca:</span>
              <span className="ml-2 font-medium">{truck.marca}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Modelo:</span>
            <span className="ml-2 font-medium">{truck.model}</span>
          </div>
          {truck.ano && (
            <div>
              <span className="text-muted-foreground">Ano:</span>
              <span className="ml-2 font-medium">{truck.ano}</span>
            </div>
          )}
          {truck.renavam && (
            <div className="col-span-2">
              <span className="text-muted-foreground">RENAVAM:</span>
              <span className="ml-2 font-medium font-mono">{truck.renavam}</span>
            </div>
          )}
        </div>
        {truck.observacoes && (
          <div className="rounded-md bg-muted p-3">
            <span className="text-sm text-muted-foreground">Observações:</span>
            <p className="mt-1 text-sm">{truck.observacoes}</p>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

export default function Fleet() {
  const { trucks, activeTrucks, totalCapacity, isLoading, createTruck, updateTruck, deleteTruck } =
    useTrucks();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [viewingTruck, setViewingTruck] = useState<Truck | null>(null);

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

  if (isLoading || roleLoading) {
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
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Caminhão
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
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
          )}
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <Eye className="mr-2 inline h-4 w-4" />
              Modo visualização — Apenas administradores podem criar, editar ou desativar veículos.
            </p>
          </div>
        )}

        {trucks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TruckIcon className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium">Nenhum caminhão cadastrado</h3>
              <p className="mb-4 text-center text-muted-foreground">
                {isAdmin 
                  ? 'Cadastre os caminhões da sua frota para começar a criar rotas'
                  : 'Aguarde um administrador cadastrar os caminhões da frota'}
              </p>
              {isAdmin && (
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Primeiro Caminhão
                </Button>
              )}
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
                      <CardDescription>
                        {truck.marca && `${truck.marca} `}{truck.model}
                        {truck.ano && ` (${truck.ano})`}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={truck.is_active}
                          onCheckedChange={() => handleToggleActive(truck)}
                        />
                      </div>
                    )}
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
                      <Badge 
                        variant={truck.is_active ? "default" : "secondary"}
                        className={cn(
                          truck.is_active ? 'bg-success hover:bg-success/90' : ''
                        )}
                      >
                        {truck.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* View Details - Available to all */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setViewingTruck(truck)}
                        >
                          <Eye className="mr-2 h-3 w-3" />
                          Detalhes
                        </Button>
                      </DialogTrigger>
                      <TruckDetailsDialog truck={truck} />
                    </Dialog>

                    {/* Edit - Admin only */}
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(truck)}
                        >
                          <Pencil className="h-3 w-3" />
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
                                pode ser desfeita. Considere desativar o veículo para manter o histórico.
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
                      </>
                    )}
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
  usePageTitle('Frota');
