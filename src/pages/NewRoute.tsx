import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WizardStepper } from '@/components/route/WizardStepper';
import { OrdersInput } from '@/components/route/OrdersInput';
import { WeightValidation } from '@/components/route/WeightValidation';
import { FleetRecommendation } from '@/components/route/FleetRecommendation';
import { RoutingStrategySelector } from '@/components/route/RoutingStrategySelector';
import { useRoutes } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';
import { RouteWizardStep, ParsedOrder, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';

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
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const validOrders = orders.filter((o) => o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);

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

  const handleNext = () => {
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

  const handleCreateRoute = async () => {
    if (!routeName.trim() || validOrders.length === 0) return;

    setIsCreating(true);
    try {
      const route = await createRoute.mutateAsync(routeName);
      navigate(`/rota/${route.id}`, {
        state: { 
          pendingOrders: validOrders,
          selectedTruckIds,
          routingStrategy,
        },
      });
    } catch (error) {
      toast({ title: 'Erro ao criar rota', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Nova Rota</h1>
          <p className="text-muted-foreground">Siga os passos para criar uma rota otimizada</p>
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
            <CardTitle>
              {currentStep === 'orders' && 'Inserir Pedidos'}
              {currentStep === 'validation' && 'Validar Peso Total'}
              {currentStep === 'fleet' && 'Selecionar Frota'}
              {currentStep === 'strategy' && 'Modo de Roteirização'}
              {currentStep === 'distribution' && 'Distribuição de Cargas'}
            </CardTitle>
            <CardDescription>
              {currentStep === 'orders' && 'Importe uma planilha ou adicione pedidos manualmente'}
              {currentStep === 'validation' && 'Confirme o peso total e dê um nome para a rota'}
              {currentStep === 'fleet' && 'Escolha os caminhões para esta rota'}
              {currentStep === 'strategy' && 'Selecione a estratégia de roteirização'}
              {currentStep === 'distribution' && 'Revise e ajuste a distribuição das cargas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 'orders' && (
              <OrdersInput orders={orders} onOrdersChange={setOrders} />
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
              <FleetRecommendation
                trucks={activeTrucks}
                totalWeight={totalWeight}
                totalOrders={validOrders.length}
                selectedTruckIds={selectedTruckIds}
                onSelectionChange={setSelectedTruckIds}
                onConfirm={handleNext}
              />
            )}

            {currentStep === 'strategy' && (
              <RoutingStrategySelector
                selectedStrategy={routingStrategy}
                onStrategyChange={setRoutingStrategy}
              />
            )}

            {currentStep === 'distribution' && (
              <div className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  Tudo pronto! Clique em "Criar Rota" para distribuir as cargas automaticamente.
                </p>
                <Button
                  size="lg"
                  onClick={handleCreateRoute}
                  disabled={isCreating}
                >
                  {isCreating ? 'Criando...' : 'Criar Rota e Distribuir'}
                </Button>
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

          {currentStep !== 'distribution' && currentStep !== 'fleet' && (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
