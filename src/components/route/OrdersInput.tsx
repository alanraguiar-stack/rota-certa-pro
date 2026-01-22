import { useState, useRef, useCallback } from 'react';
import { 
  Upload, Plus, FileSpreadsheet, Keyboard, Trash2, AlertCircle, 
  ClipboardPaste, Download, CheckCircle2, XCircle, Eye, 
  FileText, Table, RefreshCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { OrderFormData, ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/encoding';
import { 
  parseFile, 
  parsePastedData, 
  downloadTemplate, 
  ParseResult, 
  ValidationError 
} from '@/lib/orderParser';

interface OrdersInputProps {
  orders: ParsedOrder[];
  onOrdersChange: (orders: ParsedOrder[]) => void;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

// ============ Manual Order Form ============
function ManualOrderForm({ onAdd }: { onAdd: (order: OrderFormData) => void }) {
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!clientName.trim()) {
      newErrors.clientName = 'Nome do cliente é obrigatório';
    }
    
    if (!address.trim()) {
      newErrors.address = 'Endereço é obrigatório';
    } else if (address.trim().length < 10) {
      newErrors.address = 'Endereço muito curto';
    }
    
    const weight = parseFloat(weightKg);
    if (!weightKg || isNaN(weight)) {
      newErrors.weight = 'Peso é obrigatório';
    } else if (weight <= 0) {
      newErrors.weight = 'Peso deve ser maior que zero';
    } else if (weight > 50000) {
      newErrors.weight = 'Peso irreal (máx 50 toneladas)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    onAdd({
      client_name: normalizeText(clientName.trim()),
      address: normalizeText(address.trim()),
      weight_kg: parseFloat(weightKg),
    });
    
    setClientName('');
    setAddress('');
    setWeightKg('');
    setErrors({});
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
          className={errors.clientName ? 'border-destructive' : ''}
        />
        {errors.clientName && (
          <p className="text-xs text-destructive">{errors.clientName}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Endereço Completo *</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP"
          className={errors.address ? 'border-destructive' : ''}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address}</p>
        )}
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
          className={errors.weight ? 'border-destructive' : ''}
        />
        {errors.weight && (
          <p className="text-xs text-destructive">{errors.weight}</p>
        )}
      </div>
      <Button type="submit" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Pedido
      </Button>
    </form>
  );
}

// ============ File Upload Component ============
function FileUpload({ onParsed }: { onParsed: (result: ParseResult) => void }) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, envie um arquivo CSV ou Excel (.xlsx)',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const result = await parseFile(file);
      onParsed(result);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Não foi possível ler o arquivo. Verifique o formato.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
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

  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    downloadTemplate(format);
    toast({
      title: 'Template baixado!',
      description: `Arquivo template_pedidos.${format} salvo.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Template Download */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Baixar template:</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadTemplate('xlsx')}
          >
            <Table className="mr-1 h-3 w-3" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadTemplate('csv')}
          >
            <FileText className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all',
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <>
            <RefreshCcw className="mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">Processando arquivo...</p>
          </>
        ) : (
          <>
            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 text-center font-medium">
              Arraste um arquivo CSV ou Excel aqui
            </p>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              ou clique para selecionar
            </p>
            <Input
              ref={inputRef}
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
          </>
        )}
      </div>

      {/* Format Info */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Colunas detectadas automaticamente:</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">Cliente / Nome</Badge>
          <Badge variant="secondary" className="text-xs">Endereço / Local</Badge>
          <Badge variant="secondary" className="text-xs">Peso / Kg</Badge>
        </div>
      </div>
    </div>
  );
}

// ============ Paste Data Component ============
function PasteData({ onParsed }: { onParsed: (result: ParseResult) => void }) {
  const { toast } = useToast();
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);

  const handlePaste = useCallback((text: string) => {
    setPastedText(text);
    
    if (text.trim()) {
      const result = parsePastedData(text);
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handlePaste(e.target.value);
  };

  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handlePaste(text);
      toast({ title: 'Dados colados!' });
    } catch (error) {
      toast({
        title: 'Erro ao colar',
        description: 'Não foi possível acessar a área de transferência',
        variant: 'destructive',
      });
    }
  };

  const handleConfirm = () => {
    if (preview && preview.validRows > 0) {
      onParsed(preview);
      setPastedText('');
      setPreview(null);
    }
  };

  const handleClear = () => {
    setPastedText('');
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Alert>
        <ClipboardPaste className="h-4 w-4" />
        <AlertDescription>
          Copie dados do Excel ou Google Sheets e cole abaixo. O sistema detectará as colunas automaticamente.
        </AlertDescription>
      </Alert>

      {/* Paste Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleClipboardPaste}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Colar da Área de Transferência
        </Button>
        {pastedText && (
          <Button variant="ghost" size="icon" onClick={handleClear}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Text Area */}
      <Textarea
        placeholder="Cole os dados aqui ou digite manualmente...&#10;&#10;Exemplo:&#10;Cliente 1    Rua das Flores, 123    150&#10;Cliente 2    Av. Brasil, 456    200"
        value={pastedText}
        onChange={handleTextChange}
        className="min-h-[120px] font-mono text-sm"
      />

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{preview.validRows} válidos</span>
            </div>
            {preview.invalidRows > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{preview.invalidRows} com erro</span>
              </div>
            )}
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="max-h-[100px] overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2">
              {preview.errors.slice(0, 5).map((error, idx) => (
                <p key={idx} className="text-xs text-destructive">
                  Linha {error.row}: {error.message}
                </p>
              ))}
              {preview.errors.length > 5 && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {preview.errors.length - 5} erros...
                </p>
              )}
            </div>
          )}

          {/* Confirm Button */}
          {preview.validRows > 0 && (
            <Button onClick={handleConfirm} className="w-full">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Importar {preview.validRows} Pedido{preview.validRows !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Import Preview Dialog ============
function ImportPreviewDialog({
  isOpen,
  onClose,
  result,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: ParseResult | null;
  onConfirm: (orders: ParsedOrder[]) => void;
}) {
  if (!result) return null;

  const handleConfirm = () => {
    onConfirm(result.orders);
    onClose();
  };

  const successRate = result.totalRows > 0 
    ? Math.round((result.validRows / result.totalRows) * 100) 
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Pré-visualização da Importação
          </DialogTitle>
          <DialogDescription>
            Revise os dados antes de confirmar a importação
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{result.totalRows}</p>
              <p className="text-xs text-muted-foreground">Total de Linhas</p>
            </div>
            <div className="rounded-lg border p-3 text-center bg-green-50 dark:bg-green-950/20">
              <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </div>
            <div className="rounded-lg border p-3 text-center bg-red-50 dark:bg-red-950/20">
              <p className="text-2xl font-bold text-destructive">{result.invalidRows}</p>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Taxa de sucesso</span>
              <span>{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>

          {/* Errors List */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Erros Encontrados ({result.errors.length})
              </h4>
              <ScrollArea className="h-[120px] rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="space-y-1">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium text-destructive">
                        Linha {error.row} ({error.field}):
                      </span>{' '}
                      <span className="text-muted-foreground">{error.message}</span>
                      {error.value && (
                        <span className="ml-1 font-mono text-muted-foreground">
                          "{error.value}"
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Orders Preview */}
          {result.orders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Pedidos a Importar ({result.validRows})
              </h4>
              <ScrollArea className="h-[200px] rounded-lg border">
                <div className="p-2 space-y-1">
                  {result.orders.filter(o => o.isValid).slice(0, 50).map((order, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{order.client_name}</p>
                          <p className="truncate text-muted-foreground">{order.address}</p>
                        </div>
                      </div>
                      <span className="shrink-0 font-medium ml-2">
                        {formatWeight(order.weight_kg)}
                      </span>
                    </div>
                  ))}
                  {result.validRows > 50 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      + {result.validRows - 50} pedidos...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={result.validRows === 0}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Importar {result.validRows} Pedido{result.validRows !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Main Component ============
export function OrdersInput({ orders, onOrdersChange }: OrdersInputProps) {
  const { toast } = useToast();
  const [previewResult, setPreviewResult] = useState<ParseResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const validOrders = orders.filter((o) => o.isValid);
  const invalidOrders = orders.filter((o) => !o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);

  const handleAddOrder = (order: OrderFormData) => {
    onOrdersChange([
      ...orders,
      {
        ...order,
        isValid: true,
      },
    ]);
    toast({ title: 'Pedido adicionado!' });
  };

  const handleParseResult = (result: ParseResult) => {
    setPreviewResult(result);
    setIsPreviewOpen(true);
  };

  const handleConfirmImport = (newOrders: ParsedOrder[]) => {
    // Only add valid orders
    const validNewOrders = newOrders.filter(o => o.isValid);
    onOrdersChange([...orders, ...validNewOrders]);
    
    toast({
      title: `${validNewOrders.length} pedidos importados!`,
      description: validNewOrders.length > 0 
        ? `Peso total adicionado: ${formatWeight(validNewOrders.reduce((sum, o) => sum + o.weight_kg, 0))}`
        : undefined,
    });
  };

  const handleRemoveOrder = (index: number) => {
    onOrdersChange(orders.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    onOrdersChange([]);
    toast({ title: 'Todos os pedidos removidos' });
  };

  const handleFixOrder = (index: number, field: 'client_name' | 'address' | 'weight_kg', value: string) => {
    const updatedOrders = [...orders];
    const order = { ...updatedOrders[index] };
    
    if (field === 'weight_kg') {
      order.weight_kg = parseFloat(value) || 0;
    } else {
      order[field] = normalizeText(value);
    }
    
    // Re-validate
    const isValid = order.client_name.trim() && 
                    order.address.trim().length >= 10 && 
                    order.weight_kg > 0 && 
                    order.weight_kg <= 50000;
    
    order.isValid = isValid;
    order.error = isValid ? undefined : 'Revise os campos';
    
    updatedOrders[index] = order;
    onOrdersChange(updatedOrders);
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Add Orders */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Adicionar Pedidos</CardTitle>
            <CardDescription>
              Escolha a forma mais prática para você
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload">
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="upload" className="text-xs sm:text-sm">
                  <Upload className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Arquivo</span>
                </TabsTrigger>
                <TabsTrigger value="paste" className="text-xs sm:text-sm">
                  <ClipboardPaste className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Colar</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs sm:text-sm">
                  <Keyboard className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Manual</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload">
                <FileUpload onParsed={handleParseResult} />
              </TabsContent>
              <TabsContent value="paste">
                <PasteData onParsed={handleParseResult} />
              </TabsContent>
              <TabsContent value="manual">
                <ManualOrderForm onAdd={handleAddOrder} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right: Orders List */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Pedidos 
                  <Badge variant="outline">{validOrders.length}</Badge>
                  {invalidOrders.length > 0 && (
                    <Badge variant="destructive">{invalidOrders.length} erro{invalidOrders.length !== 1 ? 's' : ''}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Peso total: <span className="font-medium text-foreground">{formatWeight(totalWeight)}</span>
                </CardDescription>
              </div>
              {orders.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>Nenhum pedido adicionado</p>
                <p className="mt-1 text-sm">
                  Importe uma planilha, cole dados ou adicione manualmente
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {orders.map((order, index) => (
                    <div
                      key={index}
                      className={cn(
                        'group flex items-center justify-between rounded-lg border p-3 transition-colors',
                        order.isValid ? 'hover:bg-muted/30' : 'border-destructive/50 bg-destructive/5'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                          order.isValid ? 'bg-muted' : 'bg-destructive/20 text-destructive'
                        )}>
                          {order.isValid ? index + 1 : '!'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {order.client_name || '(sem nome)'}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {order.address || '(sem endereço)'}
                          </p>
                          {order.error && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {order.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="whitespace-nowrap text-sm font-medium">
                          {formatWeight(order.weight_kg)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOrder(index)}
                          className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        result={previewResult}
        onConfirm={handleConfirmImport}
      />
    </>
  );
}
