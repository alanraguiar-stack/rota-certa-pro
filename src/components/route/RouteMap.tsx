import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

interface OrderWithCoords {
  order: Order;
  lat: number;
  lng: number;
  sequence: number;
  truckId: string;
  truckColor: string;
  truckPlate: string;
}

interface PolylineData {
  id: string;
  positions: [number, number][];
  color: string;
  dashed: boolean;
}

export function RouteMap({ 
  trucks, 
  showAllRoutes = true, 
  selectedTruckIndex, 
  onOrderReorder,
  editable = false 
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<L.Polyline[]>([]);
  const cdMarkerRef = useRef<L.Marker | null>(null);
  
  const cd = getDistributionCenterCoords();
  const cdPosition: [number, number] = [cd.lat, cd.lng];
  const [localTrucks, setLocalTrucks] = useState<TruckRoute[]>(trucks);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Sync local state with props when trucks change externally
  useEffect(() => {
    setLocalTrucks(trucks);
    setHasChanges(false);
  }, [trucks]);
  
  // Build flattened data structures for the map
  const { polylines, ordersWithCoords, routeStats } = useMemo(() => {
    const polylinesData: PolylineData[] = [];
    const ordersData: OrderWithCoords[] = [];
    const stats: { distance: number; time: number; truck: Truck; ordersCount: number; color: string }[] = [];
    
    const visibleTrucks = showAllRoutes 
      ? localTrucks 
      : selectedTruckIndex !== undefined && localTrucks[selectedTruckIndex] 
        ? [localTrucks[selectedTruckIndex]] 
        : localTrucks;
    
    visibleTrucks.forEach((truckRoute, truckIndex) => {
      const actualIndex = showAllRoutes ? truckIndex : (selectedTruckIndex ?? truckIndex);
      const color = TRUCK_COLORS[actualIndex % TRUCK_COLORS.length];
      
      const polylinePoints: [number, number][] = [cdPosition];
      
      truckRoute.orders.forEach((order, orderIndex) => {
        // Use real coordinates if available, otherwise fall back to estimated
        let lat: number;
        let lng: number;
        
        if (order.latitude != null && order.longitude != null && 
            order.geocoding_status === 'success') {
          lat = Number(order.latitude);
          lng = Number(order.longitude);
        } else {
          const geocoded = parseAddress(order.address);
          lat = geocoded.estimatedLat;
          lng = geocoded.estimatedLng;
        }
        
        polylinePoints.push([lat, lng]);
        
        ordersData.push({
          order,
          lat,
          lng,
          sequence: orderIndex + 1,
          truckId: truckRoute.truck.id,
          truckColor: color,
          truckPlate: truckRoute.truck.plate,
        });
      });
      
      // Return to CD
      polylinePoints.push(cdPosition);
      
      polylinesData.push({
        id: truckRoute.truck.id,
        positions: polylinePoints,
        color,
        dashed: truckIndex > 0 && showAllRoutes,
      });
      
      // Calculate stats
      let distance = 0;
      for (let i = 0; i < polylinePoints.length - 1; i++) {
        distance += calculateDistance(
          polylinePoints[i][0], polylinePoints[i][1],
          polylinePoints[i + 1][0], polylinePoints[i + 1][1]
        );
      }
      const time = Math.round((distance / 30) * 60) + (truckRoute.orders.length * 5);
      
      stats.push({
        distance,
        time,
        truck: truckRoute.truck,
        ordersCount: truckRoute.orders.length,
        color,
      });
    });
    
    return { polylines: polylinesData, ordersWithCoords: ordersData, routeStats: stats };
  }, [localTrucks, showAllRoutes, selectedTruckIndex, cdPosition]);
  
  // Calculate map bounds
  const bounds = useMemo(() => {
    const allPoints: [number, number][] = [cdPosition];
    
    ordersWithCoords.forEach(o => {
      allPoints.push([o.lat, o.lng]);
    });
    
    if (allPoints.length === 1) return null;
    
    return L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1])));
  }, [ordersWithCoords, cdPosition]);
  
  const formatWeight = useCallback((weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  }, []);
  
  const formatTime = useCallback((minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${minutes}min`;
  }, []);
  
  // Handle marker drag to reorder
  const handleDragEnd = useCallback((
    orderId: string,
    truckId: string,
    newLat: number,
    newLng: number
  ) => {
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
      newPosition = 0;
    } else {
      const nearestGeo = parseAddress(nearestOrder.order.address);
      const distFromCDToNew = calculateDistance(cd.lat, cd.lng, newLat, newLng);
      const distFromCDToNearest = calculateDistance(cd.lat, cd.lng, nearestGeo.estimatedLat, nearestGeo.estimatedLng);
      
      if (distFromCDToNew < distFromCDToNearest) {
        newPosition = nearestOrder.idx;
      } else {
        newPosition = nearestOrder.idx + 1;
      }
    }
    
    if (orderIndex < newPosition) {
      newPosition = newPosition - 1;
    }
    
    const newOrders = [...truckRoute.orders];
    const [movedOrder] = newOrders.splice(orderIndex, 1);
    newOrders.splice(newPosition, 0, movedOrder);
    
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
  
  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    
    const map = L.map(mapContainerRef.current, {
      center: cdPosition,
      zoom: 12,
      scrollWheelZoom: true,
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    mapRef.current = map;
    
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [cdPosition]);
  
  // Update map content when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    polylinesRef.current.forEach(polyline => polyline.remove());
    polylinesRef.current = [];
    if (cdMarkerRef.current) {
      cdMarkerRef.current.remove();
      cdMarkerRef.current = null;
    }
    
    // Add CD marker
    const cdMarker = L.marker(cdPosition, { icon: cdIcon })
      .addTo(map)
      .bindPopup(`
        <div style="text-align: center;">
          <strong style="color: #ea580c;">Centro de Distribuição</strong>
          <p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">
            Av. Iracema, 939<br />
            Jardim Iracema, Barueri - SP
          </p>
        </div>
      `);
    cdMarkerRef.current = cdMarker;
    
    // Add polylines
    polylines.forEach((polyline) => {
      const line = L.polyline(polyline.positions, {
        color: polyline.color,
        weight: 4,
        opacity: 0.8,
        dashArray: polyline.dashed ? '10, 10' : undefined,
      }).addTo(map);
      polylinesRef.current.push(line);
    });
    
    // Add order markers
    ordersWithCoords.forEach((orderData) => {
      const marker = L.marker([orderData.lat, orderData.lng], {
        icon: createIcon(orderData.truckColor, String(orderData.sequence), false),
        draggable: editable,
      }).addTo(map);
      
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <div style="background-color: ${orderData.truckColor}; margin: -13px -19px 8px -19px; padding: 6px 12px; color: white; border-radius: 4px 4px 0 0;">
            <strong>Entrega #${orderData.sequence}</strong>
            <span style="margin-left: 8px; font-size: 11px; opacity: 0.8;">${orderData.truckPlate}</span>
          </div>
          <div style="padding: 0 4px;">
            <p style="font-weight: 500; margin: 0 0 4px 0;">${orderData.order.client_name}</p>
            <p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">${orderData.order.address}</p>
            <p style="font-size: 12px; margin: 0;">
              <strong>Peso:</strong> ${formatWeight(Number(orderData.order.weight_kg))}
            </p>
            ${editable ? '<p style="font-size: 11px; color: #888; font-style: italic; margin: 8px 0 0 0;">Arraste para reordenar</p>' : ''}
          </div>
        </div>
      `);
      
      if (editable) {
        marker.on('dragstart', () => {
          marker.setIcon(createIcon(orderData.truckColor, String(orderData.sequence), true));
        });
        
        marker.on('dragend', (e) => {
          const position = e.target.getLatLng();
          handleDragEnd(orderData.order.id, orderData.truckId, position.lat, position.lng);
          // Reset marker position (it will be updated when localTrucks changes)
          marker.setLatLng([orderData.lat, orderData.lng]);
          marker.setIcon(createIcon(orderData.truckColor, String(orderData.sequence), false));
        });
      }
      
      markersRef.current.set(orderData.order.id, marker);
    });
    
    // Fit bounds
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [polylines, ordersWithCoords, bounds, editable, cdPosition, formatWeight, handleDragEnd]);
  
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
      
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] max-h-[200px] overflow-y-auto rounded-lg bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <h4 className="mb-2 text-sm font-semibold">Rotas</h4>
        <div className="space-y-2">
          {routeStats.map((stat) => (
            <div 
              key={stat.truck.id}
              className="flex items-center gap-2 text-sm"
            >
              <div 
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: stat.color }}
              />
              <span className="font-medium">{stat.truck.plate}</span>
              <span className="text-muted-foreground">
                {stat.ordersCount} entregas • {stat.distance.toFixed(1)}km • {formatTime(stat.time)}
              </span>
            </div>
          ))}
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
