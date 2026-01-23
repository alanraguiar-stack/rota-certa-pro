import { useState } from 'react';
import { AlertTriangle, MapPin, RefreshCw, Loader2, Check, Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Order } from '@/types';
import { cn } from '@/lib/utils';

interface FailedAddressFixerProps {
  orders: Order[];
  onRetryGeocode: (orderId: string) => Promise<boolean>;
  onUpdateAddress: (orderId: string, newAddress: string) => Promise<boolean>;
  onSetManualCoords: (orderId: string, lat: number, lng: number) => Promise<void>;
  isProcessing?: boolean;
}

interface EditingState {
  orderId: string;
  address: string;
}

export function FailedAddressFixer({
  orders,
  onRetryGeocode,
  onUpdateAddress,
  onSetManualCoords,
  isProcessing = false,
}: FailedAddressFixerProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  // Filter orders that failed geocoding
  const failedOrders = orders.filter(
    o => o.geocoding_status === 'not_found' || o.geocoding_status === 'error'
  );

  if (failedOrders.length === 0) {
    return null;
  }

  const handleStartEdit = (order: Order) => {
    setEditing({ orderId: order.id, address: order.address });
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    
    setRetrying(editing.orderId);
    const success = await onUpdateAddress(editing.orderId, editing.address);
    if (success) {
      await onRetryGeocode(editing.orderId);
    }
    setRetrying(null);
    setEditing(null);
  };

  const handleRetry = async (orderId: string) => {
    setRetrying(orderId);
    await onRetryGeocode(orderId);
    setRetrying(null);
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    for (const order of failedOrders) {
      await onRetryGeocode(order.id);
    }
    setRetryingAll(false);
  };

  // Generate address suggestions based on common patterns
  const getSuggestions = (address: string): string[] => {
    const suggestions: string[] = [];
    
    // Try without number
    const withoutNumber = address.replace(/,?\s*\d+\s*[-–]?/, '');
    if (withoutNumber !== address) {
      suggestions.push(withoutNumber);
    }
    
    // Try with CEP if Brazilian
    if (address.includes('Barueri') && !address.includes('06')) {
      suggestions.push(`${address}, CEP 06400-000`);
    }
    
    // Try removing "Rua" prefix
    if (address.toLowerCase().startsWith('rua ')) {
      suggestions.push(address.replace(/^rua /i, 'R. '));
    }
    
    return suggestions.slice(0, 2);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          Endereços Não Localizados
        </CardTitle>
        <CardDescription className="text-amber-600 dark:text-amber-500">
          {failedOrders.length} endereço{failedOrders.length > 1 ? 's' : ''} não encontrado{failedOrders.length > 1 ? 's' : ''}. 
          Edite ou tente novamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Retry All Button */}
        {failedOrders.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryAll}
            disabled={retryingAll || isProcessing}
            className="w-full border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/30"
          >
            {retryingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Tentar Todos Novamente
          </Button>
        )}

        {/* List of failed addresses */}
        <div className="space-y-2">
          {failedOrders.map((order) => (
            <div
              key={order.id}
              className={cn(
                "rounded-lg border bg-card p-3 space-y-2",
                order.geocoding_status === 'error' 
                  ? "border-destructive/50" 
                  : "border-amber-300 dark:border-amber-800"
              )}
            >
              {/* Order Info */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{order.client_name}</p>
                  <div className="flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    {editing?.orderId === order.id ? (
                      <Input
                        value={editing.address}
                        onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="break-words">{order.address}</span>
                    )}
                  </div>
                </div>
                
                {/* Status Badge */}
                <span className={cn(
                  "shrink-0 text-xs px-2 py-0.5 rounded-full",
                  order.geocoding_status === 'error'
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                )}>
                  {order.geocoding_status === 'error' ? 'Erro' : 'Não encontrado'}
                </span>
              </div>

              {/* Edit/Retry Actions */}
              <div className="flex items-center gap-2">
                {editing?.orderId === order.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 px-2"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={retrying === order.id}
                      className="h-7 px-2"
                    >
                      {retrying === order.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      Salvar e Buscar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(order)}
                      disabled={isProcessing || retrying === order.id}
                      className="h-7 px-2"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(order.id)}
                      disabled={isProcessing || retrying === order.id}
                      className="h-7 px-2"
                    >
                      {retrying === order.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Tentar
                    </Button>
                  </>
                )}
              </div>

              {/* Suggestions */}
              {!editing && getSuggestions(order.address).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Sugestões:</p>
                  <div className="flex flex-wrap gap-1">
                    {getSuggestions(order.address).map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setEditing({ orderId: order.id, address: suggestion })}
                        className="text-primary hover:underline truncate max-w-full"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
