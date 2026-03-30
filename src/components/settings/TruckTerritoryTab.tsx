import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { MapPin, Save, RotateCcw, Truck } from 'lucide-react';
import { useTrucks } from '@/hooks/useTrucks';
import { useTruckTerritories, KNOWN_CITIES, getDefaultTerritory, TerritoryFormData } from '@/hooks/useTruckTerritories';
import { useToast } from '@/hooks/use-toast';

interface TruckConfig {
  truck_id: string;
  plate: string;
  model: string;
  anchor_city: string;
  fill_cities: string[];
  max_deliveries: number;
  priority: number;
  is_support: boolean;
}

export function TruckTerritoryTab() {
  const { activeTrucks, isLoading: trucksLoading } = useTrucks();
  const { territories, isLoading: territoriesLoading, saveTerritories, resetToDefaults } = useTruckTerritories();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<TruckConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize configs from DB or defaults
  useEffect(() => {
    if (trucksLoading || territoriesLoading) return;
    if (activeTrucks.length === 0) return;

    const newConfigs: TruckConfig[] = [];
    let nonFixedIndex = 0;

    for (const truck of activeTrucks) {
      const saved = territories.find(t => t.truck_id === truck.id);
      if (saved) {
        newConfigs.push({
          truck_id: truck.id,
          plate: truck.plate,
          model: truck.model,
          anchor_city: saved.anchor_city,
          fill_cities: saved.fill_cities,
          max_deliveries: saved.max_deliveries,
          priority: saved.priority,
          is_support: saved.is_support,
        });
      } else {
        const defaults = getDefaultTerritory(truck.plate, nonFixedIndex);
        // Check if this was a fixedPlate match
        const normalizedPlate = truck.plate.replace(/[\s-]/g, '').toUpperCase();
        const isFixed = ['TRC1Z00', 'TRC1ZOO'].includes(normalizedPlate);
        if (!isFixed) nonFixedIndex++;

        newConfigs.push({
          truck_id: truck.id,
          plate: truck.plate,
          model: truck.model,
          ...defaults,
        });
      }
    }

    // Sort by priority
    newConfigs.sort((a, b) => a.priority - b.priority);
    setConfigs(newConfigs);
  }, [activeTrucks, territories, trucksLoading, territoriesLoading]);

  const updateConfig = (truckId: string, updates: Partial<TruckConfig>) => {
    setConfigs(prev => prev.map(c => c.truck_id === truckId ? { ...c, ...updates } : c));
    setIsDirty(true);
  };

  const toggleFillCity = (truckId: string, city: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.truck_id !== truckId) return c;
      const has = c.fill_cities.includes(city);
      return {
        ...c,
        fill_cities: has ? c.fill_cities.filter(fc => fc !== city) : [...c.fill_cities, city],
      };
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    const data: TerritoryFormData[] = configs.map((c, idx) => ({
      truck_id: c.truck_id,
      anchor_city: c.anchor_city,
      fill_cities: c.fill_cities,
      max_deliveries: c.max_deliveries,
      priority: c.priority || (idx + 1) * 10,
      is_support: c.is_support,
    }));
    saveTerritories.mutate(data);
    setIsDirty(false);
  };

  const handleReset = () => {
    resetToDefaults.mutate();
    setIsDirty(false);
  };

  const formatCityLabel = (city: string) => {
    return city
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  if (trucksLoading || territoriesLoading) {
    return <p className="text-center text-muted-foreground py-8">Carregando...</p>;
  }

  if (activeTrucks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum caminhão ativo. Cadastre caminhões na aba Frota.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Territórios por Caminhão
          </CardTitle>
          <CardDescription>
            Defina a cidade âncora e cidades secundárias de cada caminhão. Essas regras são usadas na composição automática de rotas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={resetToDefaults.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Resetar Padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saveTerritories.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveTerritories.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {configs.map((config) => {
        const availableFillCities = KNOWN_CITIES.filter(c => c !== config.anchor_city);

        return (
          <Card key={config.truck_id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {config.plate}
                  <span className="text-muted-foreground font-normal text-sm">— {config.model}</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`support-${config.truck_id}`} className="text-xs text-muted-foreground">
                    Apoio
                  </Label>
                  <Switch
                    id={`support-${config.truck_id}`}
                    checked={config.is_support}
                    onCheckedChange={(checked) => updateConfig(config.truck_id, {
                      is_support: checked,
                      anchor_city: checked ? '' : config.anchor_city,
                    })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Anchor City */}
                <div className="space-y-2">
                  <Label>Cidade Âncora</Label>
                  <Select
                    value={config.anchor_city || '__none__'}
                    onValueChange={(v) => updateConfig(config.truck_id, {
                      anchor_city: v === '__none__' ? '' : v,
                      is_support: v === '__none__',
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem âncora (Apoio)</SelectItem>
                      {KNOWN_CITIES.map(city => (
                        <SelectItem key={city} value={city}>
                          {formatCityLabel(city)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Deliveries */}
                <div className="space-y-2">
                  <Label>Máx. Entregas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={config.max_deliveries}
                    onChange={(e) => updateConfig(config.truck_id, { max_deliveries: parseInt(e.target.value) || 25 })}
                  />
                </div>
              </div>

              {/* Fill Cities */}
              <div className="space-y-2">
                <Label>Cidades Secundárias (encaixe)</Label>
                <div className="border rounded-lg max-h-[280px] overflow-y-auto">
                  {availableFillCities.map(city => (
                    <div
                      key={city}
                      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleFillCity(config.truck_id, city)}
                    >
                      <Checkbox
                        id={`fill-${config.truck_id}-${city}`}
                        checked={config.fill_cities.includes(city)}
                        onCheckedChange={() => toggleFillCity(config.truck_id, city)}
                        className="h-5 w-5"
                      />
                      <Label
                        htmlFor={`fill-${config.truck_id}-${city}`}
                        className="text-base font-medium flex-1 cursor-pointer"
                      >
                        {formatCityLabel(city)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {isDirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saveTerritories.isPending} className="shadow-lg">
            <Save className="h-4 w-4 mr-2" />
            Salvar Territórios
          </Button>
        </div>
      )}
    </div>
  );
}
