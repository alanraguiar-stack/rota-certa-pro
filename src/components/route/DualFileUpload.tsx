/**
 * Componente de Upload Duplo para o fluxo automatizado
 * Recebe: 1) Planilha de vendas 2) Detalhamento de itens
 */

import { useState, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, 
  Download, AlertCircle, Package, RefreshCcw, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseExcelWithValidation, downloadTemplate } from '@/lib/orderParser';
import { 
  parseItemDetailFile, 
  generateItemDetailTemplate,
  ParsedItemDetail,
  ItemDetailParseResult
} from '@/lib/itemDetailParser';
import { mergeItemsIntoOrders } from '@/lib/autoRouterEngine';
import { isPDFFile, isExcelFile } from '@/lib/pdfParser';

interface DualFileUploadProps {
  onDataReady: (orders: ParsedOrder[], hasItemDetails: boolean) => void;
}

interface UploadState {
  file: File | null;
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  data: any;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

export function DualFileUpload({ onDataReady }: DualFileUploadProps) {
  const { toast } = useToast();
  
  const [salesUpload, setSalesUpload] = useState<UploadState>({
    file: null,
    status: 'idle',
    message: '',
    data: null,
  });
  
  const [itemsUpload, setItemsUpload] = useState<UploadState>({
    file: null,
    status: 'idle',
    message: '',
    data: null,
  });
  
  const salesInputRef = useRef<HTMLInputElement>(null);
  const itemsInputRef = useRef<HTMLInputElement>(null);
  
  // Handle sales file upload
  const handleSalesFile = async (file: File) => {
    const isValidFormat = isPDFFile(file) || isExcelFile(file);
    
    if (!isValidFormat) {
      setSalesUpload({
        file,
        status: 'error',
        message: 'Formato inválido. Use Excel (.xlsx) ou PDF',
        data: null,
      });
      return;
    }
    
    const processingMessage = isPDFFile(file) 
      ? 'Extraindo dados do PDF...' 
      : 'Processando planilha...';
    
    setSalesUpload({ file, status: 'processing', message: processingMessage, data: null });
    
    try {
      const result = await parseExcelWithValidation(file);
      
      if (result.validRows === 0) {
        setSalesUpload({
          file,
          status: 'error',
          message: result.errors[0]?.message || 'Nenhum pedido válido encontrado',
          data: null,
        });
        return;
      }
      
      setSalesUpload({
        file,
        status: 'success',
        message: `${result.validRows} pedidos carregados`,
        data: result,
      });
      
      toast({
        title: 'Vendas carregadas!',
        description: `${result.validRows} pedidos prontos para roteirização`,
      });
    } catch (error) {
      console.error('Error parsing sales file:', error);
      setSalesUpload({
        file,
        status: 'error',
        message: isPDFFile(file) 
          ? 'Erro ao processar PDF. Verifique se o arquivo possui texto selecionável.' 
          : 'Erro ao processar arquivo',
        data: null,
      });
    }
  };
  
  // Handle items file upload
  const handleItemsFile = async (file: File) => {
    const isValidFormat = isPDFFile(file) || isExcelFile(file);
    
    if (!isValidFormat) {
      setItemsUpload({
        file,
        status: 'error',
        message: 'Formato inválido. Use Excel (.xlsx) ou PDF',
        data: null,
      });
      return;
    }
    
    const processingMessage = isPDFFile(file) 
      ? 'Extraindo dados do PDF...' 
      : 'Processando planilha...';
    
    setItemsUpload({ file, status: 'processing', message: processingMessage, data: null });
    
    try {
      const result = await parseItemDetailFile(file);
      
      if (result.validRows === 0) {
        setItemsUpload({
          file,
          status: 'error',
          message: result.errors[0]?.message || 'Nenhum item válido encontrado',
          data: null,
        });
        return;
      }
      
      setItemsUpload({
        file,
        status: 'success',
        message: `${result.validRows} itens carregados`,
        data: result,
      });
      
      toast({
        title: 'Detalhamento carregado!',
        description: `${result.validRows} itens de produtos identificados`,
      });
    } catch (error) {
      console.error('Error parsing items file:', error);
      setItemsUpload({
        file,
        status: 'error',
        message: isPDFFile(file) 
          ? 'Erro ao processar PDF. Verifique se o arquivo possui texto selecionável.' 
          : 'Erro ao processar arquivo',
        data: null,
      });
    }
  };
  
  // Process and merge data
  const handleProcessData = () => {
    if (salesUpload.status !== 'success' || !salesUpload.data) {
      toast({
        title: 'Dados incompletos',
        description: 'Faça o upload da planilha de vendas primeiro',
        variant: 'destructive',
      });
      return;
    }
    
    let orders: ParsedOrder[] = salesUpload.data.orders;
    let hasItemDetails = false;
    
    // Merge item details if available
    if (itemsUpload.status === 'success' && itemsUpload.data) {
      const itemDetails: ParsedItemDetail[] = itemsUpload.data.items;
      orders = mergeItemsIntoOrders(orders, itemDetails);
      hasItemDetails = true;
      
      toast({
        title: 'Dados mesclados!',
        description: 'Itens detalhados associados aos pedidos',
      });
    }
    
    onDataReady(orders, hasItemDetails);
  };
  
  const canProcess = salesUpload.status === 'success';
  
  // Calculate summary
  const salesSummary = salesUpload.data ? {
    orders: salesUpload.data.validRows,
    weight: salesUpload.data.orders?.reduce((sum: number, o: ParsedOrder) => sum + o.weight_kg, 0) || 0,
  } : null;
  
  const itemsSummary = itemsUpload.data ? {
    items: itemsUpload.data.validRows,
    uniqueProducts: new Set(itemsUpload.data.items?.map((i: ParsedItemDetail) => i.product_name)).size,
  } : null;
  
  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          <strong>Fluxo Automatizado:</strong> Carregue a planilha de vendas (Excel ou PDF) e, opcionalmente, 
          o detalhamento dos itens por pedido. O sistema irá compor os caminhões automaticamente.
        </AlertDescription>
      </Alert>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales File Upload */}
        <Card className={cn(
          'transition-all',
          salesUpload.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              1. Planilha de Vendas
              {salesUpload.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
          <CardDescription>
              Pedidos com cliente, endereço e peso (Excel ou PDF)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
                salesUpload.status === 'processing' && 'opacity-50',
                salesUpload.status === 'success' && 'border-success/50 bg-success/5',
                salesUpload.status === 'error' && 'border-destructive/50 bg-destructive/5'
              )}
            >
              {salesUpload.status === 'processing' ? (
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
              ) : salesUpload.status === 'success' ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-medium text-success">{salesUpload.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">{salesUpload.file?.name}</p>
                </>
              ) : salesUpload.status === 'error' ? (
                <>
                  <XCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-sm text-destructive text-center">{salesUpload.message}</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Arraste ou clique para selecionar
                  </p>
                </>
              )}
            </div>
            
            <Input
              ref={salesInputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => e.target.files?.[0] && handleSalesFile(e.target.files[0])}
              className="hidden"
              id="sales-upload"
            />
            
            <div className="flex gap-2">
              <Label htmlFor="sales-upload" className="flex-1">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {salesUpload.file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </Label>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  downloadTemplate();
                  toast({ title: 'Template de vendas baixado!' });
                }}
                title="Baixar template"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Sales Summary */}
            {salesSummary && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{salesSummary.orders} pedidos</span>
                </div>
                <Badge variant="secondary">{formatWeight(salesSummary.weight)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Items File Upload */}
        <Card className={cn(
          'transition-all',
          itemsUpload.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              2. Detalhamento de Itens
              <Badge variant="outline" className="ml-1 text-xs">Opcional</Badge>
              {itemsUpload.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Lista de produtos por Pedido_ID (Excel ou PDF)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
                itemsUpload.status === 'processing' && 'opacity-50',
                itemsUpload.status === 'success' && 'border-success/50 bg-success/5',
                itemsUpload.status === 'error' && 'border-destructive/50 bg-destructive/5'
              )}
            >
              {itemsUpload.status === 'processing' ? (
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
              ) : itemsUpload.status === 'success' ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-medium text-success">{itemsUpload.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">{itemsUpload.file?.name}</p>
                </>
              ) : itemsUpload.status === 'error' ? (
                <>
                  <XCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-sm text-destructive text-center">{itemsUpload.message}</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Opcional: detalhamento dos itens
                  </p>
                </>
              )}
            </div>
            
            <Input
              ref={itemsInputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => e.target.files?.[0] && handleItemsFile(e.target.files[0])}
              className="hidden"
              id="items-upload"
            />
            
            <div className="flex gap-2">
              <Label htmlFor="items-upload" className="flex-1">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <FileText className="mr-2 h-4 w-4" />
                    {itemsUpload.file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </Label>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  generateItemDetailTemplate();
                  toast({ title: 'Template de itens baixado!' });
                }}
                title="Baixar template"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Items Summary */}
            {itemsSummary && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{itemsSummary.items} itens</span>
                </div>
                <Badge variant="secondary">{itemsSummary.uniqueProducts} produtos</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      {/* Process Button */}
      <div className="flex flex-col items-center gap-4">
        <Button 
          size="lg" 
          onClick={handleProcessData}
          disabled={!canProcess}
          className="w-full max-w-md"
        >
          {canProcess ? (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Processar Dados e Continuar
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Aguardando upload da planilha de vendas
            </>
          )}
        </Button>
        
        {!itemsUpload.file && salesUpload.status === 'success' && (
          <p className="text-sm text-muted-foreground text-center">
            Você pode prosseguir sem o detalhamento de itens. 
            Os pesos dos pedidos serão usados diretamente.
          </p>
        )}
      </div>
    </div>
  );
}
