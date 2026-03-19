import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Zap, Check, Truck, Route as RouteIcon, AlertTriangle, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WizardStepper } from '@/components/route/WizardStepper';
import { OrdersInput } from '@/components/route/OrdersInput';
import { DualFileUpload } from '@/components/route/DualFileUpload';
import { AutoCompositionView } from '@/components/route/AutoCompositionView';
import { WeightValidation } from '@/components/route/WeightValidation';
import { FleetRecommendation } from '@/components/route/FleetRecommendation';
import { IntelligentFleetPanel } from '@/components/route/IntelligentFleetPanel';
import { RoutingStrategySelector } from '@/components/route/RoutingStrategySelector';
import { PendingOrdersCard } from '@/components/route/PendingOrdersCard';
import { useRoutes } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';
import { useHistoryPatterns } from '@/hooks/useHistoryPatterns';
import { usePendingOrders, PendingOrder } from '@/hooks/usePendingOrders';
import { RouteWizardStep, ParsedOrder, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { autoComposeRoute, AutoRouterResult } from '@/lib/autoRouterEngine';
import { useCitySchedule } from '@/hooks/useCitySchedule';
import { analyzeFleetRequirements, validateFinalResult } from '@/lib/routeIntelligence';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function NewRoute() {
  const navigate = useNavigate();
  const { createRoute } = useRoutes();
  const { activeTrucks } = useTrucks();
  const { getHintsForOrders, patternsCount, extractedPatterns } = useHistoryPatterns();
  const { toast } = useToast();
  const { getCitiesForDate, isEnabled: isCalendarEnabled, schedule: citySchedule, getScheduleMap } = useCitySchedule();
  const { savePendingOrders, getPendingOrdersForDate, markAsRouted, cancelPending, toParsedOrders } = usePendingOrders();

  const [currentStep, setCurrentStep] = useState<RouteWizardStep>('orders');
  const [completedSteps, setCompletedSteps] = useState<RouteWizardStep[]>([]);
  const [routeName, setRouteName] = useState('');
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('padrao');
  const [isCreating, setIsCreating] = useState(false);
  
  // Auto-routing state
  const [autoResult, setAutoResult] = useState<AutoRouterResult | null>(null);
  const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');
  
  // Track if fleet was already configured (prevents re-selection)
  const [fleetConfirmed, setFleetConfirmed] = useState(false);

  // Backlog state
  const [recoveredOrders, setRecoveredOrders] = useState<PendingOrder[]>([]);
  const [storedOrders, setStoredOrders] = useState<ParsedOrder[]>([]);
  const [storedCount, setStoredCount] = useState(0);

  // Pedidos válidos são os que têm endereço (podem ser roterizados)
  const validOrders = orders.filter((o) => o.isValid);
  
  // CRÍTICO: Usar peso de TODOS os pedidos para validação de frota
  // Isso garante que o peso total do arquivo seja considerado
  const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);

  const completeStep = (step: RouteWizardStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const goToStep = (step: RouteWizardStep) => {
    setCurrentStep(step);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'orders':
        return validOrders.length > 0;
      case 'validation':
        return validOrders.length > 0 && routeName.trim().length > 0;
      case 'fleet':
        return selectedTruckIds.length > 0;
      case 'strategy':
        return routingStrategy !== null;
      default:
        return true;
    }
  };

  // Handle data from dual file upload (auto mode)
  const handleAutoDataReady = async (parsedOrders: ParsedOrder[], hasItemDetails: boolean) => {
    // Calculate allowed cities for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const allowedCities = getCitiesForDate(tomorrow) || undefined;

    let filteredOrders = parsedOrders;
    let filteredOut: ParsedOrder[] = [];

    // If calendar is active, separate allowed vs filtered-out orders
    if (isCalendarEnabled && allowedCities) {
      filteredOrders = parsedOrders.filter(o => !o.city || allowedCities.has(o.city));
      filteredOut = parsedOrders.filter(o => o.city && !allowedCities.has(o.city));

      // Save filtered-out orders to backlog
      if (filteredOut.length > 0) {
        const savedCount = await savePendingOrders(filteredOut, getScheduleMap());
        setStoredOrders(filteredOut);
        setStoredCount(savedCount);
      }

      // Recover pending orders from backlog for tomorrow's cities
      const recovered = await getPendingOrdersForDate(allowedCities);
      setRecoveredOrders(recovered);

      // Merge recovered backlog orders with current allowed orders
      if (recovered.length > 0) {
        const backlogParsed = toParsedOrders(recovered);
        filteredOrders = [...filteredOrders, ...backlogParsed];
        toast({
          title: `${recovered.length} pedido(s) do backlog recuperado(s)`,
          description: 'Pedidos de uploads anteriores foram incluídos nesta rota',
        });
      }

      if (filteredOut.length > 0) {
        toast({
          title: `${filteredOut.length} pedido(s) guardado(s) no backlog`,
          description: 'Cidades sem entrega amanhã — serão incluídos automaticamente no dia correto',
        });
      }
    }

    setOrders(filteredOrders);
    
    // Auto-compose trucks if not already configured
    if (activeTrucks.length > 0 && !fleetConfirmed) {
      const hints = getHintsForOrders(filteredOrders);
      
      const result = autoComposeRoute(filteredOrders, activeTrucks, {
        strategy: 'padrao',
        safetyMarginPercent: 10,
        maxOccupancyPercent: 95,
      }, hints.length > 0 ? hints : undefined, extractedPatterns, allowedCities ? allowedCities : undefined);
      setAutoResult(result);
      
      if (hints.length > 0) {
        toast({
          title: 'Padrões históricos aplicados',
          description: `${hints.length} padrões do analista foram considerados na composição`,
        });
      }
      
      const usedTruckIds = result.compositions
        .filter(c => c.orders.length > 0)
        .map(c => c.truck.id);
      setSelectedTruckIds(usedTruckIds);
    }
    
    completeStep('orders');
    setCurrentStep('validation');
  };

  const handleNext = () => {
    // Special handling for fleet step - mark as confirmed
    if (currentStep === 'fleet') {
      setFleetConfirmed(true);
    }
    
    completeStep(currentStep);
    const steps: RouteWizardStep[] = ['orders', 'validation', 'fleet', 'strategy', 'distribution'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: RouteWizardStep[] = ['orders', 'validation', 'fleet', 'strategy', 'distribution'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // Confirm fleet selection and proceed
  const handleConfirmFleet = () => {
    if (selectedTruckIds.length === 0) {
      toast({
        title: 'Selecione a frota',
        description: 'Escolha pelo menos um caminhão para continuar',
        variant: 'destructive',
      });
      return;
    }
    setFleetConfirmed(true);
    completeStep('fleet');
    setCurrentStep('strategy');
    toast({
      title: 'Frota confirmada!',
      description: `${selectedTruckIds.length} caminhão(ões) selecionado(s) para esta rota`,
    });
  };

  const handleCreateRoute = async () => {
    if (!routeName.trim() || validOrders.length === 0) return;

    setIsCreating(true);
    try {
      const route = await createRoute.mutateAsync(routeName);

      // Mark recovered backlog orders as routed
      if (recoveredOrders.length > 0) {
        await markAsRouted(recoveredOrders.map(o => o.id), route.id);
      }

      navigate(`/rota/${route.id}`, {
        state: { 
          pendingOrders: validOrders,
          selectedTruckIds,
          routingStrategy,
          fleetAlreadyConfigured: true,
        },
      });
    } catch (error) {
      toast({ title: 'Erro ao criar rota', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  // Get summary info for each step header
  const getStepSummary = () => {
    const summary: string[] = [];
    if (validOrders.length > 0) {
      summary.push(`${validOrders.length} pedidos`);
    }
    if (fleetConfirmed && selectedTruckIds.length > 0) {
      summary.push(`${selectedTruckIds.length} caminhões`);
    }
    if (routingStrategy) {
      const strategyLabels: Record<RoutingStrategy, string> = {
        padrao: 'Padrão',
        finalizacao_proxima: 'Fim próximo ao CD',
        finalizacao_distante: 'Fim distante',
      };
      summary.push(strategyLabels[routingStrategy]);
    }
    return summary;
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <h1 className="text-2xl font-bold">Nova Rota</h1>
            </div>
            <p className="text-muted-foreground pl-[52px]">Siga os passos para criar uma rota otimizada</p>
          </div>
          {/* Summary badges */}
          <div className="flex gap-2">
            {getStepSummary().map((item, i) => (
              <Badge key={i} variant="secondary" className="gap-1.5 px-3 py-1">
                <Check className="h-3 w-3 text-success" />
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Wizard Stepper */}
        <Card className="shadow-soft">
          <CardContent className="py-5">
            <WizardStepper
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={goToStep}
            />
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card className="shadow-elevated">
          <CardHeader className="border-b pb-5">
            <CardTitle className="flex items-center gap-3 text-xl">
              {currentStep === 'orders' && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                    <Zap className="h-5 w-5 text-accent" />
                  </div>
                  Inserir Pedidos
                </>
              )}
              {currentStep === 'validation' && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                    <Check className="h-5 w-5 text-info" />
                  </div>
                  Validar Peso Total
                </>
              )}
              {currentStep === 'fleet' && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                    <Truck className="h-5 w-5 text-success" />
                  </div>
                  Definir Frota
                  {fleetConfirmed && (
                    <Badge variant="outline" className="ml-2 text-success border-success/30 bg-success/10">
                      <Check className="h-3 w-3 mr-1" />
                      Confirmada
                    </Badge>
                  )}
                </>
              )}
              {currentStep === 'strategy' && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <RouteIcon className="h-5 w-5 text-primary" />
                  </div>
                  Estratégia de Roteirização
                </>
              )}
              {currentStep === 'distribution' && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta/10">
                    <Sparkles className="h-5 w-5 text-cta" />
                  </div>
                  Criar Rota
                </>
              )}
            </CardTitle>
            <CardDescription className="pl-[52px] pt-1">
              {currentStep === 'orders' && 'Carregue as vendas do dia para roteirização automática'}
              {currentStep === 'validation' && 'Confirme o peso total e dê um nome para a rota'}
              {currentStep === 'fleet' && (
                fleetConfirmed 
                  ? 'A frota já foi definida. Use o botão Voltar se precisar alterar.'
                  : 'Escolha os caminhões para esta rota. Esta configuração será usada em todo o processo.'
              )}
              {currentStep === 'strategy' && 'Selecione como otimizar as rotas de entrega'}
              {currentStep === 'distribution' && 'Tudo pronto! Crie a rota para prosseguir com os romaneios.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {currentStep === 'orders' && (
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'auto' | 'manual')}>
                <TabsList className="grid w-full grid-cols-2 mb-5 h-12">
                  <TabsTrigger value="auto" className="gap-2 text-sm">
                    <Zap className="h-4 w-4" />
                    Automático
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="text-sm">Manual</TabsTrigger>
                </TabsList>
                <TabsContent value="auto">
                  <DualFileUpload onDataReady={handleAutoDataReady} />
                </TabsContent>
                <TabsContent value="manual">
                  <OrdersInput orders={orders} onOrdersChange={setOrders} />
                </TabsContent>
              </Tabs>
            )}

            {currentStep === 'validation' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nome da Rota *</label>
                  <Input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Ex: Entregas Centro - 21/01"
                    className="h-12"
                  />
                </div>
                <WeightValidation orders={orders} trucks={activeTrucks} />
              </div>
            )}

            {currentStep === 'fleet' && (
              <>
                {/* Usar o novo painel inteligente que mostra o raciocínio */}
                <IntelligentFleetPanel
                  trucks={activeTrucks}
                  totalWeight={totalWeight}
                  totalOrders={validOrders.length}
                  orders={orders}
                  selectedTruckIds={selectedTruckIds}
                  onSelectionChange={setSelectedTruckIds}
                  onConfirm={handleConfirmFleet}
                  disabled={fleetConfirmed}
                />
                
                {fleetConfirmed && (
                  <div className="mt-6 p-5 rounded-2xl bg-success/10 border border-success/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/20">
                        <Check className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-semibold text-success">
                          Frota confirmada: {selectedTruckIds.length} caminhão(ões)
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Esta seleção será usada para romaneio e roteirização.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {currentStep === 'strategy' && (
              <RoutingStrategySelector
                selectedStrategy={routingStrategy}
                onStrategyChange={setRoutingStrategy}
              />
            )}

            {currentStep === 'distribution' && (
              <div className="space-y-6">
                {/* Validação Inteligente */}
                {(() => {
                  const fleetAnalysis = analyzeFleetRequirements(totalWeight, activeTrucks, 10);
                  const selectedTrucks = activeTrucks.filter(t => selectedTruckIds.includes(t.id));
                  const totalCapacity = selectedTrucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);
                  const utilizationPercent = totalCapacity > 0 ? Math.round((totalWeight / totalCapacity) * 100) : 0;
                  const isValid = totalCapacity >= totalWeight;
                  
                  return (
                    <>
                      {/* Header com status */}
                      <div className={`p-5 rounded-2xl border-2 ${isValid ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isValid ? 'bg-success/20' : 'bg-destructive/20'}`}>
                            {isValid ? (
                              <Check className="h-6 w-6 text-success" />
                            ) : (
                              <AlertTriangle className="h-6 w-6 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-lg">
                              {isValid ? 'Configuração Validada' : 'Erro de Configuração'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {isValid 
                                ? 'O sistema verificou que a frota selecionada comporta toda a carga.'
                                : 'A capacidade selecionada é insuficiente para o peso total.'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Summary of configuration */}
                      <div className="grid gap-4 sm:grid-cols-4">
                        {[
                          { label: 'Pedidos', value: validOrders.length, color: 'text-accent' },
                          { label: `de ${fleetAnalysis.minimumTrucksRequired} necessários`, value: selectedTruckIds.length, color: 'text-primary' },
                          { label: 'Peso Total', value: `${(totalWeight / 1000).toFixed(2).replace('.', ',')} t`, color: 'text-info' },
                          { label: 'Ocupação', value: `${utilizationPercent}%`, color: utilizationPercent > 95 ? 'text-warning' : 'text-success' },
                        ].map((item, index) => (
                          <div key={index} className="rounded-2xl border bg-card p-5 text-center shadow-soft">
                            <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                            <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
                
                <div className="text-center space-y-5 pt-4">
                  <p className="text-muted-foreground">
                    Clique em "Criar Rota" para salvar e prosseguir para os romaneios.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleCreateRoute}
                    disabled={isCreating}
                    className="h-14 min-w-[240px] bg-gradient-to-r from-cta to-warning text-lg font-semibold shadow-glow-cta hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {isCreating ? 'Criando...' : 'Criar Rota e Continuar'}
                    <ArrowRight className="ml-3 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={currentStep === 'orders'}
            className="h-12 px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {/* Show Continue button for steps that don't have internal confirm */}
          {currentStep !== 'distribution' && currentStep !== 'fleet' && (
            <Button size="lg" onClick={handleNext} disabled={!canProceed()} className="h-12 px-8">
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {/* For fleet step when already confirmed, show continue button */}
          {currentStep === 'fleet' && fleetConfirmed && (
            <Button size="lg" onClick={handleNext} className="h-12 px-8">
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
