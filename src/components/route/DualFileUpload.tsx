/**
 * Componente de Upload Único para o fluxo de roteirização
 * Recebe APENAS o relatório "Vendas do Dia" (itinerário) para criar a rota.
 * O "Detalhe das Vendas" (ADV) será carregado depois, na tela do Romaneio de Carga.
 */

import { useState, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, 
  AlertCircle, Package, RefreshCcw, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parseExcelWithValidation } from '@/lib/orderParser';
import { isPDFFile, isExcelFile } from '@/lib/pdfParser';
import { decodeFileContent } from '@/lib/encoding';
import {
  detectAndParsePDF,
  createOrdersFromItinerario,
  ItinerarioRecord,
  isItinerarioExcelFormat,
  isADVExcelFormat,
  parseItinerarioExcel,
} from '@/lib/advParser';
import * as XLSX from 'xlsx';

// Motor Inteligente de Leitura
import { 
  analyzeSpreadsheet, 
  formatWeight as formatWeightIntl,
  ExtractedOrder,
  SpreadsheetAnalysis,
} from '@/lib/spreadsheet';

interface DualFileUploadProps {
  onDataReady: (orders: ParsedOrder[], hasItemDetails: boolean) => void;
}

interface UploadState {
  file: File | null;
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  data: any;
  detectedType?: 'itinerario' | 'excel' | 'generic' | 'intelligent';
  analysis?: SpreadsheetAnalysis | null;
  extractedOrders?: ExtractedOrder[];
}

export function DualFileUpload({ onDataReady }: DualFileUploadProps) {
  const { toast } = useToast();
  
  const [fileUpload, setFileUpload] = useState<UploadState>({
    file: null,
    status: 'idle',
    message: '',
    data: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const processFile = async (file: File) => {
    // Excel/CSV files
    if (isExcelFile(file)) {
      setFileUpload({
        file,
        status: 'processing',
        message: 'Detectando formato da planilha...',
        data: null,
      });
      
      try {
        let rawRows: unknown[][];
        const isCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv';
        
        if (isCSV) {
          const text = await decodeFileContent(file);
          rawRows = text
            .split(/\r?\n/)
            .map(line => line.split(';').map(cell => cell.trim() || null));
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        }
        
        console.log('[DualFileUpload] Analisando arquivo:', file.name, '- Linhas:', rawRows.length);
        
        // Reject ADV files — they should be uploaded in the Romaneio step
        if (isADVExcelFormat(rawRows)) {
          setFileUpload({
            file,
            status: 'error',
            message: 'Este é um arquivo de Detalhe das Vendas (ADV). Carregue-o depois, na tela do Romaneio de Carga. Aqui, use apenas o relatório "Vendas do Dia".',
            data: null,
          });
          toast({
            title: 'Arquivo incorreto',
            description: 'O Detalhe das Vendas deve ser carregado na etapa do Romaneio de Carga, não aqui.',
            variant: 'destructive',
          });
          return;
        }
        
        // Detect Itinerário format
        let itinerarioDetected = false;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const rowHeaders = rawRows[i]?.map(c => String(c ?? '')) || [];
          if (isItinerarioExcelFormat(rowHeaders)) {
            itinerarioDetected = true;
            break;
          }
        }
        
        if (itinerarioDetected) {
          console.log('[DualFileUpload] ✅ Formato Itinerário detectado');
          setFileUpload({
            file,
            status: 'processing',
            message: 'Processando Vendas do Dia...',
            data: null,
          });
          
          const itinerarioRecords = parseItinerarioExcel(rawRows);
          
          if (itinerarioRecords.length > 0) {
            const totalWeight = itinerarioRecords.reduce((sum, r) => sum + r.weight_kg, 0);
            
            setFileUpload({
              file,
              status: 'success',
              message: `${itinerarioRecords.length} vendas | ${formatWeightIntl(totalWeight)}`,
              data: itinerarioRecords,
              detectedType: 'itinerario',
            });
            
            toast({
              title: '📍 Vendas do Dia detectado!',
              description: `${itinerarioRecords.length} vendas com endereços (${formatWeightIntl(totalWeight)})`,
            });
            return;
          }
        }
        
        // Fallback: Intelligent Engine
        console.log('[DualFileUpload] Usando Motor Inteligente como fallback');
        setFileUpload({
          file,
          status: 'processing',
          message: 'Analisando planilha com motor inteligente...',
          data: null,
        });
        
        const { analysis, orders: extractedOrders } = await analyzeSpreadsheet(file);
        
        if (extractedOrders.length > 0) {
          const totalWeight = extractedOrders.reduce((sum, o) => sum + o.weight_kg, 0);
          const hasAddresses = extractedOrders.some(o => o.address && o.address.length >= 10);
          
          if (hasAddresses) {
            const itinerarioRecords: ItinerarioRecord[] = extractedOrders.map(o => ({
              venda_id: o.pedido_id,
              client_name: o.client_name,
              address: o.address_parts.street || '',
              neighborhood: o.address_parts.neighborhood || '',
              city: o.address_parts.city || '',
              cep: o.address_parts.cep || '',
              weight_kg: o.weight_kg,
            }));
            
            setFileUpload({
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
              description: `${extractedOrders.length} pedidos (${formatWeightIntl(totalWeight)})`,
            });
            return;
          }
          
          // No addresses — not usable for routing
          setFileUpload({
            file,
            status: 'error',
            message: 'Arquivo não contém endereços de entrega. Use o relatório "Vendas do Dia".',
            data: null,
            analysis,
          });
          return;
        }
        
        const diagnostics = analysis.validation.errors.map(e => e.message).join('; ');
        setFileUpload({
          file,
          status: 'error',
          message: diagnostics || 'Não foi possível identificar dados válidos',
          data: null,
          analysis,
        });
        return;
        
      } catch (error) {
        console.error('[DualFileUpload] Erro:', error);
        setFileUpload({
          file,
          status: 'error',
          message: 'Erro ao processar arquivo',
          data: null,
        });
        return;
      }
    }
    
    // PDF files
    if (isPDFFile(file)) {
      setFileUpload({
        file,
        status: 'processing',
        message: 'Analisando PDF...',
        data: null,
      });
      
      try {
        const result = await detectAndParsePDF(file);
        
        if (result.type === 'itinerario' && result.itinerarioRecords && result.itinerarioRecords.length > 0) {
          const totalWeight = result.itinerarioRecords.reduce((sum, r) => sum + r.weight_kg, 0);
          
          setFileUpload({
            file,
            status: 'success',
            message: `${result.itinerarioRecords.length} vendas | ${formatWeightIntl(totalWeight)}`,
            data: result.itinerarioRecords,
            detectedType: 'itinerario',
          });
          
          toast({
            title: 'Vendas do Dia detectado!',
            description: `${result.itinerarioRecords.length} endereços (${formatWeightIntl(totalWeight)})`,
          });
          return;
        }
        
        if (result.type === 'adv') {
          setFileUpload({
            file,
            status: 'error',
            message: 'Este é um arquivo de Detalhe das Vendas (ADV). Carregue-o na etapa do Romaneio de Carga.',
            data: null,
          });
          toast({
            title: 'Arquivo incorreto',
            description: 'O Detalhe das Vendas deve ser carregado na etapa do Romaneio.',
            variant: 'destructive',
          });
          return;
        }
        
        // Generic PDF fallback
        const genericResult = await parseExcelWithValidation(file);
        if (genericResult.validRows > 0) {
          setFileUpload({
            file,
            status: 'success',
            message: `${genericResult.validRows} pedidos carregados`,
            data: genericResult,
            detectedType: 'generic',
          });
          return;
        }
        
        setFileUpload({
          file,
          status: 'error',
          message: 'Formato de PDF não reconhecido',
          data: null,
        });
        return;
        
      } catch (error) {
        console.error('Erro ao processar PDF:', error);
        setFileUpload({
          file,
          status: 'error',
          message: 'Erro ao processar PDF',
          data: null,
        });
        return;
      }
    }
    
    setFileUpload({
      file,
      status: 'error',
      message: 'Formato inválido. Use PDF, Excel ou CSV',
      data: null,
    });
  };
  
  const handleProcessData = () => {
    if (fileUpload.detectedType === 'itinerario' && fileUpload.data) {
      const orders = createOrdersFromItinerario(fileUpload.data);
      // Never pass items — items come later via ADV in the Romaneio step
      onDataReady(orders, false);
      return;
    }
    
    if (fileUpload.detectedType === 'generic' || fileUpload.detectedType === 'excel') {
      const result = fileUpload.data;
      if (result?.orders) {
        onDataReady(result.orders, false);
        return;
      }
    }
    
    toast({
      title: 'Nenhum dado para processar',
      description: 'Faça upload do relatório de Vendas do Dia',
      variant: 'destructive',
    });
  };
  
  const canProcess = fileUpload.status === 'success';

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Carregue o relatório <strong>Vendas do Dia</strong> (com endereços de entrega). 
          O detalhamento dos produtos (ADV) será importado depois, na etapa do Romaneio de Carga.
        </AlertDescription>
      </Alert>
      
      {/* Single file upload */}
      <Card className={cn(
        'transition-all',
        fileUpload.status === 'success' && 'ring-2 ring-success/50'
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Vendas do Dia
            {fileUpload.status === 'success' && (
              <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
            )}
          </CardTitle>
          <CardDescription>
            Relatório com clientes, endereços e pesos para roteirização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer',
              fileUpload.status === 'processing' && 'opacity-50',
              fileUpload.status === 'success' && 'border-success/50 bg-success/5',
              fileUpload.status === 'error' && 'border-destructive/50 bg-destructive/5',
              fileUpload.status === 'idle' && 'hover:border-primary/50 hover:bg-primary/5'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {fileUpload.status === 'processing' ? (
              <>
                <RefreshCcw className="h-10 w-10 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">{fileUpload.message}</p>
              </>
            ) : fileUpload.status === 'success' ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-success mb-3" />
                <p className="font-semibold text-success text-lg">{fileUpload.message}</p>
                <p className="text-sm text-muted-foreground mt-1">{fileUpload.file?.name}</p>
                <Button variant="ghost" size="sm" className="mt-3 text-xs">
                  Trocar arquivo
                </Button>
              </>
            ) : fileUpload.status === 'error' ? (
              <>
                <XCircle className="h-10 w-10 text-destructive mb-3" />
                <p className="text-sm text-destructive text-center max-w-md">{fileUpload.message}</p>
                <Button variant="ghost" size="sm" className="mt-3 text-xs">
                  Tentar outro arquivo
                </Button>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Arraste ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">PDF, Excel ou CSV</p>
              </>
            )}
          </div>
          
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,.csv"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            className="hidden"
          />
        </CardContent>
      </Card>
      
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
              Processar e Continuar
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Aguardando upload do arquivo
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
