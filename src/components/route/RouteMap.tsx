import { useEffect, useMemo, useRef, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseAddress, getDistributionCenterCoords, calculateDistance } from '@/lib/geocoding';
import { Order, Truck } from '@/types';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// Create custom icons
const createIcon = (color: string, label?: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">${label || ''}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
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

interface RouteMapProps {
  trucks: TruckRoute[];
  showAllRoutes?: boolean;
  selectedTruckIndex?: number;
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

export function RouteMap({ trucks, showAllRoutes = true, selectedTruckIndex }: RouteMapProps) {
  const mapRef = useRef<L.Map>(null);
  const cd = getDistributionCenterCoords();
  
  // Geocode all orders and build route data
  const routeData = useMemo(() => {
    return trucks.map((truckRoute, truckIndex) => {
      const color = TRUCK_COLORS[truckIndex % TRUCK_COLORS.length];
      
      const ordersWithCoords = truckRoute.orders.map((order, orderIndex) => {
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
  }, [trucks, cd.lat, cd.lng]);
  
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
  
  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };
  
  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
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
                icon={createIcon(route.color, String(orderData.sequence))}
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
            const distance = calculateRouteDistance(route.polylinePoints);
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
                  {route.orders.length} entregas • {distance.toFixed(1)}km
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
