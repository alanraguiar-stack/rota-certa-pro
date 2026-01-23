import { useState } from 'react';
import { ClipboardCheck, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Truck as TruckType, Order } from '@/types';

interface LoadingConfirmationProps {
  routeName: string;
  trucks: Array<{
    truck: TruckType;
    orders: Order[];
    totalWeight: number;
    occupancyPercent: number;
  }>;
  onConfirm: (confirmedBy: string) => void;
  isLoading?: boolean;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2)}t`;
  }
  return `${weight.toFixed(1)}kg`;
}

export function LoadingConfirmation({ routeName, trucks, onConfirm, isLoading }: LoadingConfirmationProps) {
  const [confirmedBy, setConfirmedBy] = useState('');
  
  const totalOrders = trucks.reduce((sum, t) => sum + t.orders.length, 0);
  const totalWeight = trucks.reduce((sum, t) => sum + t.totalWeight, 0);
  
  const canConfirm = confirmedBy.trim().length >= 3;
  
  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(confirmedBy.trim());
    }
  };
  
  return (
    <Card className="border-2 border-warning/50">
      <CardHeader className="bg-warning/10">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-warning" />
          Confirmar Carregamento
        </CardTitle>
        <CardDescription>
          Após conferir fisicamente a carga, confirme para liberar a roteirização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <Alert className="bg-warning/10 border-warning/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Esta ação confirma que a carga foi separada e conferida no Centro de Distribuição.
            Após a confirmação, a roteirização será liberada.
          </AlertDescription>
        </Alert>
        
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold">{trucks.length}</p>
            <p className="text-xs text-muted-foreground">Caminhões</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalOrders}</p>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{formatWeight(totalWeight)}</p>
            <p className="text-xs text-muted-foreground">Carga Total</p>
          </div>
        </div>
        
        {/* Truck badges */}
        <div className="flex flex-wrap gap-2">
          {trucks.map((t) => (
            <Badge key={t.truck.id} variant="outline" className="py-1">
              {t.truck.plate} - {formatWeight(t.totalWeight)} ({t.orders.length} pedidos)
            </Badge>
          ))}
        </div>
        
        {/* Confirmation input */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Nome do Conferente *
          </label>
          <Input
            value={confirmedBy}
            onChange={(e) => setConfirmedBy(e.target.value)}
            placeholder="Digite o nome completo do conferente"
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            Mínimo de 3 caracteres. Este nome será registrado no sistema.
          </p>
        </div>
        
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm || isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Confirmando...' : 'Confirmar Carregamento e Liberar Roteirização'}
        </Button>
      </CardContent>
    </Card>
  );
}
