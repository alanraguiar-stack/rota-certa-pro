import { useEffect, useMemo, useRef, Fragment, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseAddress, getDistributionCenterCoords, calculateDistance } from '@/lib/geocoding';
import { Order, Truck } from '@/types';
import { Badge } from '@/components/ui/badge';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// Create custom icons
const createIcon = (color: string, label?: string, isDragging?: boolean) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${isDragging ? '36px' : '28px'};
        height: ${isDragging ? '36px' : '28px'};
        border-radius: 50%;
        border: ${isDragging ? '4px' : '3px'} solid white;
        box-shadow: 0 ${isDragging ? '4px 12px' : '2px 6px'} rgba(0,0,0,${isDragging ? '0.5' : '0.3'});
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isDragging ? '14px' : '12px'};
        transition: all 0.2s ease;
        cursor: ${isDragging ? 'grabbing' : 'grab'};
      ">${label || ''}</div>
    `,
    iconSize: [isDragging ? 36 : 28, isDragging ? 36 : 28],
    iconAnchor: [isDragging ? 18 : 14, isDragging ? 18 : 14],
    popupAnchor: [0, isDragging ? -18 : -14],
  });
};

const cdIcon = L.divIcon({
  className: 'cd-marker',
  html: `
    <div style="
      background: linear-gradient(135deg, #f97316, #ea580c);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 3px 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
    ">CD</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

// Color palette for trucks
const TRUCK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

interface TruckRoute {
  truck: Truck;
  orders: Order[];
  totalWeight: number;
  occupancyPercent: number;
}

interface OrderReorder {
  orderId: string;
  truckId: string;
  newSequence: number;
}

interface RouteMapProps {
  trucks: TruckRoute[];
  showAllRoutes?: boolean;
  selectedTruckIndex?: number;
  onOrderReorder?: (reorders: OrderReorder[]) => Promise<void>;
  editable?: boolean;
}

function MapBoundsUpdater({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  
  return null;
}

interface OrderWithCoords {
  order: Order;
  lat: number;
  lng: number;
  sequence: number;
  geocoded: ReturnType<typeof parseAddress>;
}

interface RouteDataItem {
  truck: Truck;
  orders: OrderWithCoords[];
  polylinePoints: [number, number][];
  color: string;
  totalWeight: number;
  occupancyPercent: number;
}

export function RouteMap({ 
  trucks, 
  showAllRoutes = true, 
  selectedTruckIndex, 
  onOrderReorder,
  editable = false 
}: RouteMapProps) {
  const mapRef = useRef<L.Map>(null);
  const cd = getDistributionCenterCoords();
  const [localTrucks, setLocalTrucks] = useState<TruckRoute[]>(trucks);
  const [draggingOrder, setDraggingOrder] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Sync local state with props when trucks change externally
  useEffect(() => {
    setLocalTrucks(trucks);
    setHasChanges(false);
  }, [trucks]);
  
  // Geocode all orders and build route data
  const routeData = useMemo((): RouteDataItem[] => {
    return localTrucks.map((truckRoute, truckIndex) => {
      const color = TRUCK_COLORS[truckIndex % TRUCK_COLORS.length];
      
      const ordersWithCoords: OrderWithCoords[] = truckRoute.orders.map((order, orderIndex) => {
        const geocoded = parseAddress(order.address);
        return {
          order,
          lat: geocoded.estimatedLat,
          lng: geocoded.estimatedLng,
          sequence: orderIndex + 1,
          geocoded,
        };
      });
      
      // Build polyline points: CD -> orders -> CD (if return route)
      const polylinePoints: [number, number][] = [[cd.lat, cd.lng]];
      ordersWithCoords.forEach(o => {
        polylinePoints.push([o.lat, o.lng]);
      });
      // Return to CD
      polylinePoints.push([cd.lat, cd.lng]);
      
      return {
        truck: truckRoute.truck,
        orders: ordersWithCoords,
        polylinePoints,
        color,
        totalWeight: truckRoute.totalWeight,
        occupancyPercent: truckRoute.occupancyPercent,
      };
    });
  }, [localTrucks, cd.lat, cd.lng]);
  
  // Calculate map bounds
  const bounds = useMemo(() => {
    const allPoints: [number, number][] = [[cd.lat, cd.lng]];
    
    routeData.forEach(route => {
      route.orders.forEach(o => {
        allPoints.push([o.lat, o.lng]);
      });
    });
    
    if (allPoints.length === 1) return null;
    
    return L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1])));
  }, [routeData, cd.lat, cd.lng]);
  
  // Filter routes to display
  const visibleRoutes = useMemo(() => {
    if (showAllRoutes) return routeData;
    if (selectedTruckIndex !== undefined && routeData[selectedTruckIndex]) {
      return [routeData[selectedTruckIndex]];
    }
    return routeData;
  }, [routeData, showAllRoutes, selectedTruckIndex]);
  
  // Calculate total distance for each route
  const calculateRouteDistance = (points: [number, number][]) => {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += calculateDistance(
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1]
      );
    }
    return total;
  };
  
  // Calculate estimated time based on distance
  const calculateRouteTime = (distanceKm: number) => {
    const avgSpeedKmH = 30; // Average speed in urban areas
    const deliveryTimeMinutes = 5; // Time per delivery
    const totalTimeMinutes = (distanceKm / avgSpeedKmH) * 60;
    return Math.round(totalTimeMinutes);
  };
  
  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };
  
  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${minutes}min`;
  };
  
  // Handle marker drag to reorder
  const handleMarkerDragEnd = useCallback((
    orderId: string,
    truckId: string,
    newLat: number,
    newLng: number
  ) => {
    setDraggingOrder(null);
    
    // Find which truck and position this should go to
    const truckIndex = localTrucks.findIndex(t => t.truck.id === truckId);
    if (truckIndex === -1) return;
    
    const truckRoute = localTrucks[truckIndex];
    const orderIndex = truckRoute.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;
    
    // Find the closest position in the route based on the new coordinates
    const ordersWithDistances = truckRoute.orders.map((order, idx) => {
      if (order.id === orderId) return { order, idx, distance: Infinity };
      const geocoded = parseAddress(order.address);
      const distance = calculateDistance(newLat, newLng, geocoded.estimatedLat, geocoded.estimatedLng);
      return { order, idx, distance };
    });
    
    // Also consider CD as potential neighbor
    const distanceToCD = calculateDistance(newLat, newLng, cd.lat, cd.lng);
    
    // Find the nearest order that isn't the dragged one
    const nearestOrder = ordersWithDistances
      .filter(o => o.order.id !== orderId)
      .sort((a, b) => a.distance - b.distance)[0];
    
    let newPosition: number;
    
    if (!nearestOrder || distanceToCD < nearestOrder.distance) {
      // Closest to CD - put at position 0 (first delivery)
      newPosition = 0;
    } else {
      // Determine if it should go before or after the nearest order
      const nearestGeo = parseAddress(nearestOrder.order.address);
      const distFromCDToNew = calculateDistance(cd.lat, cd.lng, newLat, newLng);
      const distFromCDToNearest = calculateDistance(cd.lat, cd.lng, nearestGeo.estimatedLat, nearestGeo.estimatedLng);
      
      if (distFromCDToNew < distFromCDToNearest) {
        newPosition = nearestOrder.idx;
      } else {
        newPosition = nearestOrder.idx + 1;
      }
    }
    
    // Adjust if moving from a position before the new position
    if (orderIndex < newPosition) {
      newPosition = newPosition - 1;
    }
    
    // Reorder the orders array
    const newOrders = [...truckRoute.orders];
    const [movedOrder] = newOrders.splice(orderIndex, 1);
    newOrders.splice(newPosition, 0, movedOrder);
    
    // Update local state
    setLocalTrucks(prev => {
      const updated = [...prev];
      updated[truckIndex] = {
        ...updated[truckIndex],
        orders: newOrders,
      };
      return updated;
    });
    
    setHasChanges(true);
  }, [localTrucks, cd.lat, cd.lng]);
  
  // Save changes to database
  const handleSaveChanges = async () => {
    if (!onOrderReorder || !hasChanges) return;
    
    setIsSaving(true);
    
    try {
      const reorders: OrderReorder[] = [];
      
      localTrucks.forEach(truckRoute => {
        truckRoute.orders.forEach((order, index) => {
          reorders.push({
            orderId: order.id,
            truckId: truckRoute.truck.id,
            newSequence: index + 1,
          });
        });
      });
      
      await onOrderReorder(reorders);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving reorder:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Reset to original order
  const handleReset = () => {
    setLocalTrucks(trucks);
    setHasChanges(false);
  };
  
  // Route stats for legend
  const routeStats = useMemo(() => {
    return routeData.map(route => {
      const distance = calculateRouteDistance(route.polylinePoints);
      const time = calculateRouteTime(distance) + (route.orders.length * 5);
      return { distance, time };
    });
  }, [routeData]);
  
  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
      {/* Edit controls */}
      {editable && (
        <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2">
          {hasChanges && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Desfazer
              </Button>
              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </>
          )}
          {!hasChanges && (
            <Badge variant="secondary" className="gap-1">
              <GripVertical className="h-3 w-3" />
              Arraste os marcadores para reordenar
            </Badge>
          )}
        </div>
      )}
      
      <MapContainer
        ref={mapRef}
        center={[cd.lat, cd.lng]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBoundsUpdater bounds={bounds} />
        
        {/* Distribution Center Marker */}
        <Marker position={[cd.lat, cd.lng]} icon={cdIcon}>
          <Popup>
            <div className="text-center">
              <strong className="text-orange-600">Centro de Distribuição</strong>
              <p className="text-sm text-gray-600">
                Av. Iracema, 939<br />
                Jardim Iracema, Barueri - SP
              </p>
            </div>
          </Popup>
        </Marker>
        
        {/* Route polylines and markers */}
        {visibleRoutes.map((route, routeIndex) => (
          <Fragment key={route.truck.id}>
            {/* Route polyline */}
            <Polyline
              positions={route.polylinePoints}
              pathOptions={{
                color: route.color,
                weight: 4,
                opacity: 0.8,
                dashArray: routeIndex > 0 && showAllRoutes ? '10, 10' : undefined,
              }}
            />
            
            {/* Order markers */}
            {route.orders.map((orderData) => (
              <Marker
                key={orderData.order.id}
                position={[orderData.lat, orderData.lng]}
                icon={createIcon(
                  route.color, 
                  String(orderData.sequence),
                  draggingOrder === orderData.order.id
                )}
                draggable={editable}
                eventHandlers={editable ? {
                  dragstart: () => {
                    setDraggingOrder(orderData.order.id);
                  },
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    handleMarkerDragEnd(
                      orderData.order.id,
                      route.truck.id,
                      position.lat,
                      position.lng
                    );
                    // Reset marker to its calculated position
                    marker.setLatLng([orderData.lat, orderData.lng]);
                  },
                } : undefined}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div 
                      className="mb-2 rounded-t px-2 py-1 text-white"
                      style={{ backgroundColor: route.color }}
                    >
                      <strong>Entrega #{orderData.sequence}</strong>
                      <span className="ml-2 text-xs opacity-80">
                        {route.truck.plate}
                      </span>
                    </div>
                    <div className="space-y-1 px-1">
                      <p className="font-medium">{orderData.order.client_name}</p>
                      <p className="text-sm text-gray-600">{orderData.order.address}</p>
                      <p className="text-sm">
                        <strong>Peso:</strong> {formatWeight(Number(orderData.order.weight_kg))}
                      </p>
                      {editable && (
                        <p className="mt-2 text-xs text-muted-foreground italic">
                          Arraste para reordenar
                        </p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </Fragment>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] max-h-[200px] overflow-y-auto rounded-lg bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <h4 className="mb-2 text-sm font-semibold">Rotas</h4>
        <div className="space-y-2">
          {routeData.map((route, index) => {
            const stats = routeStats[index];
            const isVisible = showAllRoutes || selectedTruckIndex === index;
            
            return (
              <div 
                key={route.truck.id}
                className={`flex items-center gap-2 text-sm ${!isVisible ? 'opacity-40' : ''}`}
              >
                <div 
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: route.color }}
                />
                <span className="font-medium">{route.truck.plate}</span>
                <span className="text-muted-foreground">
                  {route.orders.length} entregas • {stats.distance.toFixed(1)}km • {formatTime(stats.time)}
                </span>
              </div>
            );
          })}
        </div>
        
        {hasChanges && (
          <div className="mt-3 border-t pt-2">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Alterações não salvas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}