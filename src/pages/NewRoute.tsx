import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, FileSpreadsheet, Keyboard } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRoutes } from '@/hooks/useRoutes';
import { OrderFormData, ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';

function ManualOrderForm({ onAdd }: { onAdd: (order: OrderFormData) => void }) {
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      client_name: clientName,
      address,
      weight_kg: parseFloat(weightKg),
    });
    setClientName('');
    setAddress('');
    setWeightKg('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clientName">Nome do Cliente *</Label>
        <Input
          id="clientName"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Ex: Restaurante do João"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço Completo *</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ex: Rua das Flores, 123 - Centro"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weight">Peso (kg) *</Label>
        <Input
          id="weight"
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="Ex: 150"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Pedido
      </Button>
    </form>
  );
}

function FileUpload({ onParsed }: { onParsed: (orders: ParsedOrder[]) => void }) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (content: string): ParsedOrder[] => {
    const lines = content.split('\n').filter((line) => line.trim());
    const orders: ParsedOrder[] = [];

    // Skip header if exists
    const startIndex = lines[0]?.toLowerCase().includes('cliente') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[,;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length >= 3) {
        const weight = parseFloat(parts[2]);
        if (parts[0] && parts[1] && !isNaN(weight) && weight > 0) {
          orders.push({
            client_name: parts[0],
            address: parts[1],
            weight_kg: weight,
            isValid: true,
          });
        } else {
          orders.push({
            client_name: parts[0] || '',
            address: parts[1] || '',
            weight_kg: weight || 0,
            isValid: false,
            error: 'Dados inválidos na linha ' + (i + 1),
          });
        }
      }
    }

    return orders;
  };

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, envie um arquivo CSV ou Excel',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const orders = parseCSV(text);
        onParsed(orders);
      } else {
        toast({
          title: 'Excel ainda não suportado',
          description: 'Por enquanto, use arquivos CSV. Suporte a Excel em breve!',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Não foi possível ler o arquivo',
        variant: 'destructive',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
      <p className="mb-2 text-center font-medium">Arraste um arquivo CSV aqui</p>
      <p className="mb-4 text-center text-sm text-muted-foreground">
        ou clique para selecionar
      </p>
      <Input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleChange}
        className="hidden"
        id="file-upload"
      />
      <Label htmlFor="file-upload">
        <Button variant="outline" asChild>
          <span>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Selecionar Arquivo
          </span>
        </Button>
      </Label>
      <p className="mt-4 text-xs text-muted-foreground">
        Formato esperado: Cliente, Endereço, Peso (kg)
      </p>
    </div>
  );
}

export default function NewRoute() {
  const navigate = useNavigate();
  const { createRoute } = useRoutes();
  const { toast } = useToast();
  const [routeName, setRouteName] = useState('');
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const validOrders = orders.filter((o) => o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);

  const handleAddOrder = (order: OrderFormData) => {
    setOrders([
      ...orders,
      {
        ...order,
        isValid: true,
      },
    ]);
    toast({ title: 'Pedido adicionado!' });
  };

  const handleFileOrders = (parsedOrders: ParsedOrder[]) => {
    setOrders([...orders, ...parsedOrders]);
    const valid = parsedOrders.filter((o) => o.isValid).length;
    const invalid = parsedOrders.length - valid;
    toast({
      title: `${valid} pedidos importados`,
      description: invalid > 0 ? `${invalid} linhas com erro foram ignoradas` : undefined,
    });
  };

  const handleRemoveOrder = (index: number) => {
    setOrders(orders.filter((_, i) => i !== index));
  };

  const handleCreateRoute = async () => {
    if (!routeName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Dê um nome para a rota',
        variant: 'destructive',
      });
      return;
    }

    if (validOrders.length === 0) {
      toast({
        title: 'Sem pedidos',
        description: 'Adicione pelo menos um pedido válido',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const route = await createRoute.mutateAsync(routeName);
      navigate(`/rota/${route.id}`, {
        state: { pendingOrders: validOrders },
      });
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsCreating(false);
    }
  };

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Nova Rota</h1>
          <p className="text-muted-foreground">Crie uma nova rota adicionando pedidos</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Add Orders */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Nome da Rota</CardTitle>
                <CardDescription>Identifique esta rota de entregas</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Ex: Entregas Centro - 21/01"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adicionar Pedidos</CardTitle>
                <CardDescription>
                  Importe de uma planilha ou adicione manualmente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload">
                  <TabsList className="mb-4 grid w-full grid-cols-2">
                    <TabsTrigger value="upload">
                      <Upload className="mr-2 h-4 w-4" />
                      Importar
                    </TabsTrigger>
                    <TabsTrigger value="manual">
                      <Keyboard className="mr-2 h-4 w-4" />
                      Manual
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload">
                    <FileUpload onParsed={handleFileOrders} />
                  </TabsContent>
                  <TabsContent value="manual">
                    <ManualOrderForm onAdd={handleAddOrder} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right: Orders List */}
          <Card>
            <CardHeader>
              <CardTitle>Pedidos ({validOrders.length})</CardTitle>
              <CardDescription>
                Peso total: {formatWeight(totalWeight)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>Nenhum pedido adicionado</p>
                </div>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {orders.map((order, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        order.isValid ? '' : 'border-destructive/50 bg-destructive/5'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{order.client_name || '(sem nome)'}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {order.address || '(sem endereço)'}
                        </p>
                        {order.error && (
                          <p className="text-xs text-destructive">{order.error}</p>
                        )}
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <span className="whitespace-nowrap text-sm font-medium">
                          {formatWeight(order.weight_kg)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOrder(index)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validOrders.length > 0 && (
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  onClick={handleCreateRoute}
                  disabled={isCreating}
                >
                  {isCreating ? 'Criando...' : 'Criar Rota e Continuar'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
