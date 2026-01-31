import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Zap, Check, Truck, Route as RouteIcon, Brain, AlertTriangle } from 'lucide-react';
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
import { useRoutes } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';
import { RouteWizardStep, ParsedOrder, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { autoComposeRoute, AutoRouterResult } from '@/lib/autoRouterEngine';
import { analyzeFleetRequirements, validateFinalResult } from '@/lib/routeIntelligence';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function NewRoute() {
  const navigate = useNavigate();
  const { createRoute } = useRoutes();
  const { activeTrucks } = useTrucks();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<RouteWizardStep>('orders');
  const [completedSteps, setCompletedSteps] = useState<RouteWizardStep[]>([]);
  const [routeName, setRouteName] = useState('');
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([]);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('economy');
  const [isCreating, setIsCreating] = useState(false);
  
  // Auto-routing state
  const [autoResult, setAutoResult] = useState<AutoRouterResult | null>(null);
  const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');
  
  // Track if fleet was already configured (prevents re-selection)
  const [fleetConfirmed, setFleetConfirmed] = useState(false);

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
  const handleAutoDataReady = (parsedOrders: ParsedOrder[], hasItemDetails: boolean) => {
    setOrders(parsedOrders);
    
    // Auto-compose trucks if not already configured
    if (activeTrucks.length > 0 && !fleetConfirmed) {
      const result = autoComposeRoute(parsedOrders, activeTrucks, {
        strategy: 'economy',
        safetyMarginPercent: 10,
        maxOccupancyPercent: 95,
      });
      setAutoResult(result);
      
      // Auto-select trucks used in composition
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
      navigate(`/rota/${route.id}`, {
        state: { 
          pendingOrders: validOrders,
          selectedTruckIds, // Pass the already-selected trucks
          routingStrategy,
          fleetAlreadyConfigured: true, // Signal that fleet was configured in wizard
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
        economy: 'Economia',
        speed: 'Velocidade',
        end_near_cd: 'Fim no CD',
        start_far: 'Longe→Perto',
        start_near: 'Perto→Longe',
      };
      summary.push(strategyLabels[routingStrategy]);
    }
    return summary;
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nova Rota</h1>
            <p className="text-muted-foreground">Siga os passos para criar uma rota otimizada</p>
          </div>
          {/* Summary badges */}
          <div className="flex gap-2">
            {getStepSummary().map((item, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Wizard Stepper */}
        <Card>
          <CardContent className="py-4">
            <WizardStepper
              currentStep={currentStep}
              completedSteps={completedSteps}
              onStepClick={goToStep}
            />
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentStep === 'orders' && 'Inserir Pedidos'}
              {currentStep === 'validation' && 'Validar Peso Total'}
              {currentStep === 'fleet' && (
                <>
                  <Truck className="h-5 w-5" />
                  Definir Frota
                  {fleetConfirmed && (
                    <Badge variant="outline" className="ml-2 text-success border-success">
                      <Check className="h-3 w-3 mr-1" />
                      Confirmada
                    </Badge>
                  )}
                </>
              )}
              {currentStep === 'strategy' && (
                <>
                  <RouteIcon className="h-5 w-5" />
                  Estratégia de Roteirização
                </>
              )}
              {currentStep === 'distribution' && 'Criar Rota'}
            </CardTitle>
            <CardDescription>
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
          <CardContent>
            {currentStep === 'orders' && (
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'auto' | 'manual')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="auto" className="gap-2">
                    <Zap className="h-4 w-4" />
                    Automático
                  </TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
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
                  <label className="text-sm font-medium">Nome da Rota *</label>
                  <Input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="Ex: Entregas Centro - 21/01"
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
                  selectedTruckIds={selectedTruckIds}
                  onSelectionChange={setSelectedTruckIds}
                  onConfirm={handleConfirmFleet}
                  disabled={fleetConfirmed}
                />
                
                {fleetConfirmed && (
                  <div className="mt-4 p-4 rounded-lg bg-success/10 border border-success/30">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-success" />
                      <p className="text-sm text-success font-medium">
                        Frota confirmada: {selectedTruckIds.length} caminhão(ões)
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta seleção será usada para romaneio e roteirização. Use "Voltar" para alterar.
                    </p>
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
                      <div className={`p-4 rounded-lg border-2 ${isValid ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
                        <div className="flex items-center gap-3">
                          {isValid ? (
                            <Check className="h-6 w-6 text-success" />
                          ) : (
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                          )}
                          <div>
                            <p className="font-semibold text-lg">
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
                        <div className="rounded-lg border p-4 text-center">
                          <p className="text-2xl font-bold text-primary">{validOrders.length}</p>
                          <p className="text-sm text-muted-foreground">Pedidos</p>
                        </div>
                        <div className="rounded-lg border p-4 text-center">
                          <p className="text-2xl font-bold text-primary">{selectedTruckIds.length}</p>
                          <p className="text-sm text-muted-foreground">de {fleetAnalysis.minimumTrucksRequired} necessários</p>
                        </div>
                        <div className="rounded-lg border p-4 text-center">
                          <p className="text-2xl font-bold text-primary">
                            {(totalWeight / 1000).toFixed(2).replace('.', ',')} t
                          </p>
                          <p className="text-sm text-muted-foreground">Peso Total</p>
                        </div>
                        <div className="rounded-lg border p-4 text-center">
                          <p className={`text-2xl font-bold ${utilizationPercent > 95 ? 'text-warning' : 'text-success'}`}>
                            {utilizationPercent}%
                          </p>
                          <p className="text-sm text-muted-foreground">Ocupação</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
                
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    Clique em "Criar Rota" para salvar e prosseguir para os romaneios.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleCreateRoute}
                    disabled={isCreating}
                    className="min-w-[200px]"
                  >
                    {isCreating ? 'Criando...' : 'Criar Rota e Continuar'}
                    <ArrowRight className="ml-2 h-4 w-4" />
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
            onClick={handleBack}
            disabled={currentStep === 'orders'}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {/* Show Continue button for steps that don't have internal confirm */}
          {currentStep !== 'distribution' && currentStep !== 'fleet' && (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {/* For fleet step when already confirmed, show continue button */}
          {currentStep === 'fleet' && fleetConfirmed && (
            <Button onClick={handleNext}>
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
