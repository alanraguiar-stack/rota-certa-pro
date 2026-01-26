/**
 * Componente colapsável para correção de endereços
 * Ocupa menos espaço visual, expandindo apenas quando necessário
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Order } from '@/types';
import { FailedAddressFixer } from './FailedAddressFixer';
import { cn } from '@/lib/utils';

interface CollapsibleAddressFixerProps {
  orders: Order[];
  onRetryGeocode: (orderId: string) => Promise<boolean>;
  onUpdateAddress: (orderId: string, newAddress: string) => Promise<boolean>;
  onSetManualCoords: (orderId: string, lat: number, lng: number) => Promise<void>;
  onStartMapSelection?: (orderId: string, clientName: string) => void;
  onContinueAnyway?: () => void;
  selectingOnMapFor?: string | null;
  isProcessing?: boolean;
}

export function CollapsibleAddressFixer({
  orders,
  onRetryGeocode,
  onUpdateAddress,
  onSetManualCoords,
  onStartMapSelection,
  onContinueAnyway,
  selectingOnMapFor,
  isProcessing,
}: CollapsibleAddressFixerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter orders that failed geocoding
  const failedOrders = orders.filter(
    o => o.geocoding_status === 'not_found' || o.geocoding_status === 'error'
  );

  if (failedOrders.length === 0) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "rounded-lg border",
        isOpen
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
          : "border-amber-200/70 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10"
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between h-auto p-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div className="text-left">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Endereços Não Localizados
              </span>
              <p className="text-xs text-amber-600 dark:text-amber-500 font-normal">
                {isOpen ? 'Clique para recolher' : 'Clique para expandir e corrigir'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
              {failedOrders.length}
            </Badge>
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-amber-600" />
            ) : (
              <ChevronRight className="h-5 w-5 text-amber-600" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          <FailedAddressFixer
            orders={orders}
            onRetryGeocode={onRetryGeocode}
            onUpdateAddress={onUpdateAddress}
            onSetManualCoords={onSetManualCoords}
            onStartMapSelection={onStartMapSelection}
            onContinueAnyway={onContinueAnyway}
            selectingOnMapFor={selectingOnMapFor}
            isProcessing={isProcessing}
            canContinue={true}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
