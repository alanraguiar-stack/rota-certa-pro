/**
 * Componente de Upload Duplo para o fluxo automatizado
 * Recebe dois PDFs complementares:
 * 1) Relatório Geral de Vendas (endereços)
 * 2) Detalhe das Vendas (itens detalhados)
 * 
 * Os arquivos podem ser carregados em qualquer ordem.
 * O sistema detecta automaticamente o tipo e cruza pelo número da venda.
 * 
 * ATUALIZADO: Agora usa o Motor Inteligente de Leitura de Planilhas
 * que opera como um analista logístico humano:
 * - Lê TUDO primeiro
 * - Entende o significado dos dados
 * - Valida coerência antes de decidir
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, 
  Download, AlertCircle, Package, RefreshCcw, FileText, Link2,
  Scale, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseExcelWithValidation, downloadTemplate } from '@/lib/orderParser';
import { 
  parseItemDetailFile, 
  generateItemDetailTemplate,
  ParsedItemDetail,
} from '@/lib/itemDetailParser';
import { mergeItemsIntoOrders } from '@/lib/autoRouterEngine';
import { isPDFFile, isExcelFile } from '@/lib/pdfParser';
import {
  detectAndParsePDF,
  mergeItinerarioWithADV,
  createOrdersFromItinerario,
  ItinerarioRecord,
  PDFDetectionResult,
  isItinerarioExcelFormat,
  isADVExcelFormat,
  parseItinerarioExcel,
  parseADVDetailExcel,
} from '@/lib/advParser';
import * as XLSX from 'xlsx';

// Motor Inteligente de Leitura
import { 
  analyzeSpreadsheet, 
  convertToLegacyFormat,
  formatWeight as formatWeightIntl,
  SpreadsheetAnalysis,
  ExtractedOrder,
} from '@/lib/spreadsheet';

interface DualFileUploadProps {
  onDataReady: (orders: ParsedOrder[], hasItemDetails: boolean) => void;
}

interface UploadState {
  file: File | null;
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  data: any;
  detectedType?: 'adv' | 'itinerario' | 'excel' | 'generic' | 'intelligent';
  analysis?: SpreadsheetAnalysis | null;
  extractedOrders?: ExtractedOrder[];
}

interface MergeSummary {
  total: number;
  matched: number;
  unmatched: number;
}

// Usar formatWeight local para consistência, mas disponibilizar o inteligente também
function formatWeightDisplay(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

export function DualFileUpload({ onDataReady }: DualFileUploadProps) {
  const { toast } = useToast();
  
  // Estado para arquivo 1 (Itinerário/Vendas)
  const [file1Upload, setFile1Upload] = useState<UploadState>({
    file: null,
    status: 'idle',
    message: '',
    data: null,
  });
  
  // Estado para arquivo 2 (ADV/Itens)
  const [file2Upload, setFile2Upload] = useState<UploadState>({
    file: null,
    status: 'idle',
    message: '',
    data: null,
  });
  
  // Estado do cruzamento
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  const [mergedOrders, setMergedOrders] = useState<ParsedOrder[] | null>(null);
  
  const file1InputRef = useRef<HTMLInputElement>(null);
  const file2InputRef = useRef<HTMLInputElement>(null);
  
  // Processar arquivo com MOTOR INTELIGENTE como primeira opção
  const processFile = async (
    file: File,
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>
  ): Promise<{ type: string; data: any } | null> => {
    
    // PRIMEIRO: Tentar o Motor Inteligente para arquivos Excel
    if (isExcelFile(file)) {
      setUploadState({
        file,
        status: 'processing',
        message: 'Analisando planilha com motor inteligente...',
        data: null,
      });
      
      try {
        console.log('[DualFileUpload] Usando Motor Inteligente para:', file.name);
        
        // Usar o novo motor inteligente
        const { analysis, orders: extractedOrders } = await analyzeSpreadsheet(file);
        
        // Verificar se conseguiu extrair dados
        if (extractedOrders.length > 0) {
          const totalWeight = extractedOrders.reduce((sum, o) => sum + o.weight_kg, 0);
          const hasAddresses = extractedOrders.some(o => o.address && o.address.length >= 10);
          
          // Determinar tipo baseado no formato detectado
          let detectedType: UploadState['detectedType'] = 'intelligent';
          if (analysis.format === 'mb_itinerario' || analysis.format === 'itinerario_generic') {
            detectedType = 'itinerario';
          } else if (analysis.format === 'mb_detalhe' || analysis.format === 'adv_hierarchical') {
            detectedType = 'adv';
          }
          
          // Converter para formato legado
          const legacyOrders = convertToLegacyFormat(extractedOrders);
          
          // Criar ItinerarioRecord se tiver endereços (para compatibilidade com merge)
          if (hasAddresses && (detectedType === 'itinerario' || detectedType === 'intelligent')) {
            const itinerarioRecords: ItinerarioRecord[] = extractedOrders.map(o => ({
              venda_id: o.pedido_id,
              client_name: o.client_name,
              address: o.address_parts.street || '',
              neighborhood: o.address_parts.neighborhood || '',
              city: o.address_parts.city || '',
              cep: o.address_parts.cep || '',
              weight_kg: o.weight_kg,
            }));
            
            setUploadState({
              file,
              status: 'success',
              message: `${extractedOrders.length} vendas | ${formatWeightIntl(totalWeight)}`,
              data: itinerarioRecords,
              detectedType: 'itinerario',
              analysis,
              extractedOrders,
            });
            
            toast({
              title: '✅ Motor Inteligente',
              description: `${extractedOrders.length} pedidos (${formatWeightIntl(totalWeight)}) - ${analysis.format}`,
            });
            
            return { type: 'itinerario', data: itinerarioRecords };
          }
          
          // Se não tem endereços, é tipo ADV (só itens)
          setUploadState({
            file,
            status: 'success',
            message: `${extractedOrders.length} pedidos | ${formatWeightIntl(totalWeight)}`,
            data: legacyOrders,
            detectedType,
            analysis,
            extractedOrders,
          });
          
          toast({
            title: '✅ Planilha analisada',
            description: `${extractedOrders.length} pedidos (${formatWeightIntl(totalWeight)})`,
          });
          
          return { type: detectedType, data: legacyOrders };
        }
        
        // Se motor inteligente não encontrou dados, mostrar diagnóstico
        const diagnostics = analysis.validation.errors.map(e => e.message).join('; ');
        
        setUploadState({
          file,
          status: 'error',
          message: diagnostics || 'Não foi possível identificar dados válidos',
          data: null,
          analysis,
        });
        
        return null;
        
      } catch (error) {
        console.error('[DualFileUpload] Erro no motor inteligente:', error);
        
        // Fallback para parser antigo
        console.log('[DualFileUpload] Tentando parser legado...');
      }
    }
    
    // Verificar se é PDF
    if (isPDFFile(file)) {
      setUploadState({
        file,
        status: 'processing',
        message: 'Analisando PDF...',
        data: null,
      });
      
      try {
        const result = await detectAndParsePDF(file);
        
        if (result.type === 'itinerario' && result.itinerarioRecords && result.itinerarioRecords.length > 0) {
          const totalWeight = result.itinerarioRecords.reduce((sum, r) => sum + r.weight_kg, 0);
          
          setUploadState({
            file,
            status: 'success',
            message: `${result.itinerarioRecords.length} vendas | ${formatWeightIntl(totalWeight)}`,
            data: result.itinerarioRecords,
            detectedType: 'itinerario',
          });
          
          toast({
            title: 'Relatório Geral detectado!',
            description: `${result.itinerarioRecords.length} endereços (${formatWeightIntl(totalWeight)})`,
          });
          
          return { type: 'itinerario', data: result.itinerarioRecords };
        }
        
        if (result.type === 'adv' && result.advOrders && result.advOrders.length > 0) {
          const totalWeight = result.advOrders.reduce((sum, o) => sum + o.weight_kg, 0);
          
          setUploadState({
            file,
            status: 'success',
            message: `${result.advOrders.length} pedidos | ${formatWeightIntl(totalWeight)}`,
            data: result.advOrders,
            detectedType: 'adv',
          });
          
          toast({
            title: 'Detalhe das Vendas detectado!',
            description: `${result.advOrders.length} pedidos (${formatWeightIntl(totalWeight)})`,
          });
          
          return { type: 'adv', data: result.advOrders };
        }
        
        // Tentar parser genérico de PDF
        const genericResult = await parseExcelWithValidation(file);
        if (genericResult.validRows > 0) {
          setUploadState({
            file,
            status: 'success',
            message: `${genericResult.validRows} pedidos carregados`,
            data: genericResult,
            detectedType: 'generic',
          });
          return { type: 'generic', data: genericResult };
        }
        
        setUploadState({
          file,
          status: 'error',
          message: 'Formato de PDF não reconhecido',
          data: null,
        });
        return null;
        
      } catch (error) {
        console.error('Erro ao processar PDF:', error);
        setUploadState({
          file,
          status: 'error',
          message: 'Erro ao processar PDF',
          data: null,
        });
        return null;
      }
    }
    
    setUploadState({
      file,
      status: 'error',
      message: 'Formato inválido. Use PDF ou Excel',
      data: null,
    });
    return null;
  };
  
  // Handler para arquivo 1
  const handleFile1 = async (file: File) => {
    const result = await processFile(file, setFile1Upload);
    if (result) {
      tryMergeData(result, file2Upload);
    }
  };
  
  // Handler para arquivo 2
  const handleFile2 = async (file: File) => {
    const result = await processFile(file, setFile2Upload);
    if (result) {
      tryMergeData(file1Upload, result);
    }
  };
  
  // Tentar cruzar dados quando ambos arquivos estão prontos
  const tryMergeData = (
    data1: { type: string; data: any } | UploadState,
    data2: { type: string; data: any } | UploadState
  ) => {
    // Normalizar para mesmo formato
    const normalize = (d: any): { type: string; data: any } | null => {
      if (!d) return null;
      if ('type' in d && 'data' in d && typeof d.type === 'string') {
        return d as { type: string; data: any };
      }
      if ('status' in d && d.status === 'success' && d.data && d.detectedType) {
        return { type: d.detectedType, data: d.data };
      }
      return null;
    };
    
    const file1Data = normalize(data1);
    const file2Data = normalize(data2);
    
    if (!file1Data || !file2Data) return;
    
    console.log('[DualFileUpload] Tentando cruzar:', file1Data.type, '+', file2Data.type);
    
    // Identificar qual é itinerário e qual é ADV
    let itinerarioRecords: ItinerarioRecord[] | null = null;
    let advOrders: ParsedOrder[] | null = null;
    
    if (file1Data.type === 'itinerario') {
      itinerarioRecords = file1Data.data;
    } else if (file1Data.type === 'adv') {
      advOrders = file1Data.data;
    }
    
    if (file2Data.type === 'itinerario') {
      itinerarioRecords = file2Data.data;
    } else if (file2Data.type === 'adv') {
      advOrders = file2Data.data;
    }
    
    // Se temos ambos, fazer o cruzamento
    if (itinerarioRecords && advOrders) {
      console.log('[DualFileUpload] Cruzando dados...');
      const merged = mergeItinerarioWithADV(itinerarioRecords, advOrders);
      
      const matchedCount = merged.filter(o => o.isValid).length;
      const unmatchedCount = merged.filter(o => !o.isValid).length;
      
      setMergedOrders(merged);
      setMergeSummary({
        total: merged.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
      });
      
      toast({
        title: 'Dados cruzados!',
        description: `${matchedCount} pedidos completos, ${unmatchedCount} sem endereço`,
      });
    }
  };
  
  // Efeito para tentar cruzar quando ambos arquivos estiverem prontos
  useEffect(() => {
    if (file1Upload.status === 'success' && file2Upload.status === 'success') {
      tryMergeData(file1Upload, file2Upload);
    }
  }, [file1Upload.status, file2Upload.status]);
  
  // Processar e continuar
  const handleProcessData = () => {
    // Se temos dados cruzados, usar eles
    if (mergedOrders && mergedOrders.length > 0) {
      onDataReady(mergedOrders, true);
      return;
    }
    
    // Se só temos itinerário, criar pedidos a partir dele
    if (file1Upload.detectedType === 'itinerario' && file1Upload.data) {
      const orders = createOrdersFromItinerario(file1Upload.data);
      onDataReady(orders, false);
      return;
    }
    
    if (file2Upload.detectedType === 'itinerario' && file2Upload.data) {
      const orders = createOrdersFromItinerario(file2Upload.data);
      onDataReady(orders, false);
      return;
    }
    
    // Se temos ADV sem itinerário, alertar
    if (file1Upload.detectedType === 'adv' || file2Upload.detectedType === 'adv') {
      toast({
        title: 'Dados incompletos',
        description: 'O Detalhe das Vendas não contém endereços. Carregue também o Relatório Geral.',
        variant: 'destructive',
      });
      return;
    }
    
    // Se temos Excel/genérico
    if (file1Upload.detectedType === 'excel' || file1Upload.detectedType === 'generic') {
      const result = file1Upload.data;
      if (result && result.orders) {
        onDataReady(result.orders, false);
        return;
      }
    }
    
    if (file2Upload.detectedType === 'excel' || file2Upload.detectedType === 'generic') {
      const result = file2Upload.data;
      if (result && result.orders) {
        onDataReady(result.orders, false);
        return;
      }
    }
    
    toast({
      title: 'Nenhum dado para processar',
      description: 'Faça upload de pelo menos um arquivo',
      variant: 'destructive',
    });
  };
  
  const canProcess = 
    file1Upload.status === 'success' || 
    file2Upload.status === 'success' ||
    mergedOrders !== null;
  
  // Estatísticas
  const getFileSummary = (upload: UploadState): { count: number; label: string } | null => {
    if (upload.status !== 'success' || !upload.data) return null;
    
    if (upload.detectedType === 'itinerario') {
      return { count: upload.data.length, label: 'endereços' };
    }
    if (upload.detectedType === 'adv') {
      return { count: upload.data.length, label: 'pedidos' };
    }
    if (upload.detectedType === 'excel' || upload.detectedType === 'generic') {
      return { count: upload.data.validRows || upload.data.orders?.length || 0, label: 'pedidos' };
    }
    return null;
  };
  
  const file1Summary = getFileSummary(file1Upload);
  const file2Summary = getFileSummary(file2Upload);
  
  // Determinar labels dinâmicos
  const getFileLabel = (upload: UploadState, defaultLabel: string): string => {
    if (upload.detectedType === 'itinerario') return 'Relatório Geral de Vendas';
    if (upload.detectedType === 'adv') return 'Detalhe das Vendas';
    if (upload.detectedType === 'excel') return 'Planilha Excel';
    return defaultLabel;
  };
  
  const getFileIcon = (upload: UploadState) => {
    if (upload.detectedType === 'itinerario') return <FileSpreadsheet className="h-5 w-5 text-primary" />;
    if (upload.detectedType === 'adv') return <FileText className="h-5 w-5 text-primary" />;
    return <FileSpreadsheet className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          <strong>Cruzamento Automático:</strong> Carregue dois arquivos PDF - o <strong>Relatório Geral de Vendas</strong> (com endereços) 
          e o <strong>Detalhe das Vendas</strong> (com itens detalhados). O sistema irá cruzar os dados automaticamente pelo número da venda.
        </AlertDescription>
      </Alert>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arquivo 1 */}
        <Card className={cn(
          'transition-all min-w-0',
          file1Upload.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base flex-wrap">
              {getFileIcon(file1Upload)}
              {getFileLabel(file1Upload, '1. Relatório Geral de Vendas')}
              {file1Upload.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              {file1Upload.detectedType === 'itinerario' 
                ? 'Contém endereços de entrega por venda'
                : file1Upload.detectedType === 'adv'
                ? 'Contém itens detalhados por venda'
                : 'PDF ou Excel com dados de vendas'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
                file1Upload.status === 'processing' && 'opacity-50',
                file1Upload.status === 'success' && 'border-success/50 bg-success/5',
                file1Upload.status === 'error' && 'border-destructive/50 bg-destructive/5'
              )}
            >
              {file1Upload.status === 'processing' ? (
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
              ) : file1Upload.status === 'success' ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-medium text-success">{file1Upload.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">{file1Upload.file?.name}</p>
                </>
              ) : file1Upload.status === 'error' ? (
                <>
                  <XCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-sm text-destructive text-center">{file1Upload.message}</p>
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
              ref={file1InputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => e.target.files?.[0] && handleFile1(e.target.files[0])}
              className="hidden"
              id="file1-upload"
            />
            
            <div className="flex gap-2">
              <Label htmlFor="file1-upload" className="flex-1">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {file1Upload.file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </Label>
            </div>
            
            {/* File 1 Summary */}
            {file1Summary && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{file1Summary.count} {file1Summary.label}</span>
                </div>
                <Badge variant="secondary">{file1Upload.detectedType}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Arquivo 2 */}
        <Card className={cn(
          'transition-all min-w-0',
          file2Upload.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base flex-wrap">
              {getFileIcon(file2Upload)}
              {getFileLabel(file2Upload, '2. Detalhe das Vendas')}
              <Badge variant="outline" className="ml-1 text-xs">Opcional</Badge>
              {file2Upload.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              {file2Upload.detectedType === 'itinerario' 
                ? 'Contém endereços de entrega por venda'
                : file2Upload.detectedType === 'adv'
                ? 'Contém itens detalhados por venda'
                : 'Para cruzamento automático de dados'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
                file2Upload.status === 'processing' && 'opacity-50',
                file2Upload.status === 'success' && 'border-success/50 bg-success/5',
                file2Upload.status === 'error' && 'border-destructive/50 bg-destructive/5'
              )}
            >
              {file2Upload.status === 'processing' ? (
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
              ) : file2Upload.status === 'success' ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                  <p className="font-medium text-success">{file2Upload.message}</p>
                  <p className="text-sm text-muted-foreground mt-1">{file2Upload.file?.name}</p>
                </>
              ) : file2Upload.status === 'error' ? (
                <>
                  <XCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-sm text-destructive text-center">{file2Upload.message}</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Opcional: segundo arquivo para cruzamento
                  </p>
                </>
              )}
            </div>
            
            <Input
              ref={file2InputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={(e) => e.target.files?.[0] && handleFile2(e.target.files[0])}
              className="hidden"
              id="file2-upload"
            />
            
            <div className="flex gap-2">
              <Label htmlFor="file2-upload" className="flex-1">
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <FileText className="mr-2 h-4 w-4" />
                    {file2Upload.file ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                  </span>
                </Button>
              </Label>
            </div>
            
            {/* File 2 Summary */}
            {file2Summary && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{file2Summary.count} {file2Summary.label}</span>
                </div>
                <Badge variant="secondary">{file2Upload.detectedType}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Merge Summary */}
      {mergeSummary && (
        <Alert className={cn(
          mergeSummary.unmatched > 0 ? 'border-warning' : 'border-success'
        )}>
          <Link2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Cruzamento concluído:</strong>{' '}
            <span className="text-success font-medium">{mergeSummary.matched} pedidos</span> cruzados com sucesso
            {mergeSummary.unmatched > 0 && (
              <>, <span className="text-warning font-medium">{mergeSummary.unmatched} pedidos</span> sem endereço correspondente</>
            )}
          </AlertDescription>
        </Alert>
      )}
      
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
              {mergedOrders ? `Continuar com ${mergedOrders.filter(o => o.isValid).length} Pedidos` : 'Processar e Continuar'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Aguardando upload de arquivo
            </>
          )}
        </Button>
        
        {file1Upload.status === 'success' && file2Upload.status !== 'success' && (
          <p className="text-sm text-muted-foreground text-center">
            {file1Upload.detectedType === 'adv' 
              ? 'Carregue o Relatório Geral para obter os endereços de entrega.'
              : file1Upload.detectedType === 'itinerario'
              ? 'Você pode prosseguir ou carregar o Detalhe das Vendas para itens detalhados.'
              : 'Você pode prosseguir ou carregar um segundo arquivo para cruzamento.'}
          </p>
        )}
      </div>
    </div>
  );
}
