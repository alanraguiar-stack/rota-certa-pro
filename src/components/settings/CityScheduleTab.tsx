import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCitySchedule, CitySchedule } from '@/hooks/useCitySchedule';
import { TERRITORY_RULES } from '@/lib/anchorRules';
import { CalendarDays, Save, CheckSquare, XSquare, Info } from 'lucide-react';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getAllCities(): string[] {
  const cities = new Set<string>();
  for (const rule of TERRITORY_RULES) {
    if (rule.anchorCity) cities.add(rule.anchorCity);
    for (const c of rule.allowedFillCities) cities.add(c);
    for (const nf of rule.neighborhoodFills) cities.add(nf.city);
    for (const ne of rule.neighborhoodExceptions) cities.add(ne.city);
  }
  // Sort alphabetically, capitalize
  return Array.from(cities).sort();
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, l => l.toUpperCase());
}

export function CityScheduleTab() {
  const { schedule, isEnabled, loading, toggleEnabled, saveSchedule } = useCitySchedule();
  const { toast } = useToast();
  const cities = useMemo(() => getAllCities(), []);

  // Local draft state (deep copy of schedule using arrays instead of Sets)
  const [draft, setDraft] = useState<Record<string, number[]>>({});
  const [dirty, setDirty] = useState(false);

  // Sync draft from loaded schedule
  useEffect(() => {
    const d: Record<string, number[]> = {};
    for (const [city, days] of Object.entries(schedule)) {
      d[city] = Array.from(days);
    }
    setDraft(d);
    setDirty(false);
  }, [schedule]);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getDay();
  }, []);

  const tomorrowCities = useMemo(() => {
    return cities.filter(c => (draft[c] || []).includes(tomorrow));
  }, [draft, tomorrow, cities]);

  const toggleDay = (city: string, day: number) => {
    setDraft(prev => {
      const days = prev[city] || [];
      const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
      return { ...prev, [city]: next };
    });
    setDirty(true);
  };

  const markAll = () => {
    const d: Record<string, number[]> = {};
    for (const city of cities) {
      d[city] = [1, 2, 3, 4, 5, 6]; // Seg-Sáb
    }
    setDraft(d);
    setDirty(true);
  };

  const clearAll = () => {
    setDraft({});
    setDirty(true);
  };

  const handleSave = async () => {
    const sched: CitySchedule = {};
    for (const [city, days] of Object.entries(draft)) {
      if (days.length > 0) sched[city] = new Set(days);
    }
    await saveSchedule(sched);
    setDirty(false);
    toast({ title: 'Calendário salvo com sucesso!' });
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Calendário de Entregas
                  {isEnabled ? (
                    <Badge variant="default" className="text-xs">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure os dias da semana com entregas em cada cidade
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrar por dia</span>
              <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={!isEnabled ? 'opacity-50 pointer-events-auto' : ''}>
          {/* Tomorrow preview */}
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <p className="text-sm">
              <span className="font-medium">Amanhã ({DAY_FULL[tomorrow]})</span>
              {tomorrowCities.length > 0 ? (
                <> — entregas em: <span className="font-medium text-primary">{tomorrowCities.map(capitalize).join(', ')}</span></>
              ) : (
                <> — <span className="text-muted-foreground">nenhuma cidade configurada</span></>
              )}
            </p>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground min-w-[160px]">Cidade</th>
                  {DAY_LABELS.map((label, i) => (
                    <th
                      key={i}
                      className={`text-center py-2 px-2 font-medium min-w-[48px] ${
                        i === tomorrow ? 'bg-primary/10 text-primary rounded-t-md' : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                      {i === tomorrow && <div className="text-[10px] leading-none mt-0.5">amanhã</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map(city => (
                  <tr key={city} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-4 font-medium">{capitalize(city)}</td>
                    {DAY_LABELS.map((_, dayIdx) => {
                      const checked = (draft[city] || []).includes(dayIdx);
                      return (
                        <td
                          key={dayIdx}
                          className={`text-center py-2.5 px-2 ${
                            dayIdx === tomorrow ? 'bg-primary/5' : ''
                          } ${dayIdx === 0 ? 'opacity-40' : ''}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleDay(city, dayIdx)}
                            className="mx-auto"
                            disabled={dayIdx === 0} // Domingo disabled
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Marcar Todos
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
                <XSquare className="h-3.5 w-3.5" />
                Limpar Todos
              </Button>
            </div>
            <Button onClick={handleSave} disabled={!dirty} className="gap-1.5">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
