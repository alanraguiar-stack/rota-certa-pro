/**
 * Componente de Colagem Dupla para entrada manual
 * Recebe dados colados de duas fontes:
 * 1) Itinerário de Vendas (endereços)
 * 2) Relatório ADV (itens detalhados)
 * 
 * Os dados podem ser colados em qualquer ordem.
 * O sistema detecta automaticamente o tipo e cruza pelo número da venda.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  ClipboardPaste, CheckCircle2, XCircle, 
  AlertCircle, RefreshCcw, FileText, Link2, MapPin, Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ParsedOrder, ParsedOrderItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { parsePastedData } from '@/lib/orderParser';

interface DualPasteDataProps {
  onParsed: (orders: ParsedOrder[]) => void;
}

interface PasteAreaState {
  text: string;
  status: 'idle' | 'parsing' | 'success' | 'error';
  message: string;
  data: any[];
  detectedType?: 'itinerario' | 'adv' | 'generic';
}

interface MergeSummary {
  total: number;
  matched: number;
  unmatched: number;
}

// Detectar tipo de dados colados
function detectPastedDataType(text: string): 'itinerario' | 'adv' | 'generic' {
  const lowerText = text.toLowerCase();
  
  // Itinerário: detectado por colunas de entrega
  if (/end\.?\s*ent|bairro\.?\s*ent|cep\.?\s*ent|cidade\.?\s*ent/i.test(text)) {
    return 'itinerario';
  }
  
  // ADV: detectado por estrutura hierárquica ou padrões específicos
  if (/vendas\s*detalhadas|cliente:|qtd\.?\s*ped|#\s*cliente/i.test(text)) {
    return 'adv';
  }
  
  // Se tem headers típicos de itinerário
  if (/venda\s+cliente\s+.*end/i.test(lowerText)) {
    return 'itinerario';
  }
  
  return 'generic';
}

// Parsear dados de itinerário (formato tabular com colunas)
function parseItinerarioData(text: string): { records: any[]; vendaIds: Set<string> } {
  const lines = text.trim().split('\n');
  const records: any[] = [];
  const vendaIds = new Set<string>();
  
  if (lines.length < 2) return { records, vendaIds };
  
  // Encontrar índices das colunas pelo header
  const headerLine = lines[0].toLowerCase();
  const headers = lines[0].split('\t');
  
  // Mapear colunas importantes
  const findCol = (patterns: RegExp[]): number => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().trim();
      for (const p of patterns) {
        if (p.test(h)) return i;
      }
    }
    return -1;
  };
  
  const vendaCol = findCol([/^venda$/i, /n[º°]?\s*venda/i]);
  const clienteCol = findCol([/^cliente$/i, /nome.*cliente/i]);
  const endCol = findCol([/end\.?\s*ent/i, /endere[çc]o.*ent/i]);
  const bairroCol = findCol([/bairro\.?\s*ent/i]);
  const cidadeCol = findCol([/cidade\.?\s*ent/i]);
  const cepCol = findCol([/cep\.?\s*ent/i]);
  const ufCol = findCol([/uf\.?\s*ent/i, /estado.*ent/i]);
  const pesoCol = findCol([/peso\s*bruto/i, /peso/i]);
  
  console.log('[DualPasteData] Colunas detectadas:', {
    venda: vendaCol, cliente: clienteCol, end: endCol,
    bairro: bairroCol, cidade: cidadeCol, cep: cepCol, peso: pesoCol
  });
  
  // Processar linhas de dados
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 3) continue;
    
    const venda = vendaCol >= 0 ? cols[vendaCol]?.trim() : '';
    const cliente = clienteCol >= 0 ? cols[clienteCol]?.trim() : '';
    
    // Construir endereço
    const rua = endCol >= 0 ? cols[endCol]?.trim() : '';
    const bairro = bairroCol >= 0 ? cols[bairroCol]?.trim() : '';
    const cidade = cidadeCol >= 0 ? cols[cidadeCol]?.trim() : '';
    const cep = cepCol >= 0 ? cols[cepCol]?.trim() : '';
    const uf = ufCol >= 0 ? cols[ufCol]?.trim() : '';
    
    // Peso
    let peso = 0;
    if (pesoCol >= 0) {
      const pesoStr = cols[pesoCol]?.replace(/[^\d.,]/g, '').replace(',', '.');
      peso = parseFloat(pesoStr) || 0;
    }
    
    // Montar endereço completo
    const addressParts = [rua, bairro, cidade, uf ? `${cidade} - ${uf}` : '', cep].filter(Boolean);
    const address = addressParts.join(', ').replace(/, ,/g, ',');
    
    if (venda && (cliente || address)) {
      vendaIds.add(venda);
      records.push({
        pedido_id: venda,
        client_name: cliente,
        address: address || 'Endereço não informado',
        weight_kg: peso,
      });
    }
  }
  
  return { records, vendaIds };
}

// Parsear dados ADV (formato hierárquico)
function parseADVData(text: string): { orders: ParsedOrder[]; vendaIds: Set<string> } {
  const orders: ParsedOrder[] = [];
  const vendaIds = new Set<string>();
  
  // Tentar detectar formato tabular (colunas separadas por tab)
  const lines = text.trim().split('\n');
  
  // Se parece tabular, processar como tabela
  if (lines.length > 1 && lines[0].includes('\t')) {
    const headers = lines[0].split('\t');
    
    // Encontrar colunas
    const findCol = (patterns: RegExp[]): number => {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        for (const p of patterns) {
          if (p.test(h)) return i;
        }
      }
      return -1;
    };
    
    const vendaCol = findCol([/^venda$/i, /n[º°]?\s*venda/i, /pedido/i]);
    const clienteCol = findCol([/^cliente$/i, /nome/i]);
    const produtoCol = findCol([/produto/i, /descri[çc][ãa]o/i, /item/i]);
    const qtdCol = findCol([/qtd/i, /quantidade/i]);
    const pesoCol = findCol([/peso/i, /kg/i]);
    
    // Agrupar por venda
    const vendaMap = new Map<string, { cliente: string; items: ParsedOrderItem[] }>();
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const venda = vendaCol >= 0 ? cols[vendaCol]?.trim() : `AUTO_${i}`;
      const cliente = clienteCol >= 0 ? cols[clienteCol]?.trim() : '';
      const produto = produtoCol >= 0 ? cols[produtoCol]?.trim() : 'Produto';
      
      let qtd = 1;
      if (qtdCol >= 0) {
        qtd = parseInt(cols[qtdCol]?.replace(/\D/g, '')) || 1;
      }
      
      let peso = 0;
      if (pesoCol >= 0) {
        const pesoStr = cols[pesoCol]?.replace(/[^\d.,]/g, '').replace(',', '.');
        peso = parseFloat(pesoStr) || 0;
      }
      
      if (venda) {
        vendaIds.add(venda);
        
        if (!vendaMap.has(venda)) {
          vendaMap.set(venda, { cliente, items: [] });
        }
        
        const entry = vendaMap.get(venda)!;
        if (!entry.cliente && cliente) entry.cliente = cliente;
        
        entry.items.push({
          product_name: produto || 'Produto',
          weight_kg: peso,
          quantity: qtd,
        });
      }
    }
    
    // Converter para ParsedOrder
    vendaMap.forEach((data, vendaId) => {
      const totalWeight = data.items.reduce((sum, item) => sum + item.weight_kg * item.quantity, 0);
      orders.push({
        pedido_id: vendaId,
        client_name: data.cliente,
        address: '', // ADV não tem endereço
        weight_kg: totalWeight,
        items: data.items,
        isValid: false, // Precisa de endereço
        error: 'Sem endereço - necessita cruzamento com itinerário',
      });
    });
  }
  
  return { orders, vendaIds };
}

// Cruzar itinerário com ADV
function mergeItinerarioWithADV(
  itinerarioRecords: any[], 
  advOrders: ParsedOrder[]
): ParsedOrder[] {
  const merged: ParsedOrder[] = [];
  const advMap = new Map<string, ParsedOrder>();
  
  // Indexar ADV por pedido_id
  advOrders.forEach(order => {
    if (order.pedido_id) {
      advMap.set(order.pedido_id, order);
    }
  });
  
  // Cruzar com itinerário
  itinerarioRecords.forEach(record => {
    const advOrder = advMap.get(record.pedido_id);
    
    merged.push({
      pedido_id: record.pedido_id,
      client_name: record.client_name || advOrder?.client_name || 'Cliente',
      address: record.address,
      weight_kg: advOrder?.weight_kg || record.weight_kg || 0,
      items: advOrder?.items || [],
      isValid: Boolean(record.address && record.address !== 'Endereço não informado'),
    });
    
    // Remover do mapa para saber quais sobraram
    advMap.delete(record.pedido_id);
  });
  
  // Adicionar pedidos ADV que não tiveram match
  advMap.forEach(order => {
    merged.push({
      ...order,
      isValid: false,
      error: 'Sem endereço no itinerário',
    });
  });
  
  return merged;
}

export function DualPasteData({ onParsed }: DualPasteDataProps) {
  const { toast } = useToast();
  
  // Estado para área 1 (Itinerário)
  const [area1, setArea1] = useState<PasteAreaState>({
    text: '',
    status: 'idle',
    message: '',
    data: [],
  });
  
  // Estado para área 2 (ADV)
  const [area2, setArea2] = useState<PasteAreaState>({
    text: '',
    status: 'idle',
    message: '',
    data: [],
  });
  
  // Estado do cruzamento
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  const [mergedOrders, setMergedOrders] = useState<ParsedOrder[] | null>(null);
  
  // Processar texto colado
  const processText = useCallback((
    text: string, 
    areaNum: 1 | 2,
    setAreaState: React.Dispatch<React.SetStateAction<PasteAreaState>>
  ) => {
    if (!text.trim()) {
      setAreaState({
        text: '',
        status: 'idle',
        message: '',
        data: [],
      });
      return null;
    }
    
    setAreaState(prev => ({
      ...prev,
      text,
      status: 'parsing',
      message: 'Analisando dados...',
    }));
    
    const type = detectPastedDataType(text);
    console.log(`[DualPasteData] Área ${areaNum} tipo detectado:`, type);
    
    if (type === 'itinerario') {
      const { records, vendaIds } = parseItinerarioData(text);
      
      if (records.length === 0) {
        setAreaState({
          text,
          status: 'error',
          message: 'Nenhum endereço encontrado',
          data: [],
        });
        return null;
      }
      
      setAreaState({
        text,
        status: 'success',
        message: `${records.length} endereços detectados`,
        data: records,
        detectedType: 'itinerario',
      });
      
      toast({
        title: 'Itinerário detectado!',
        description: `${records.length} endereços de entrega`,
      });
      
      return { type: 'itinerario', data: records };
    }
    
    if (type === 'adv') {
      const { orders, vendaIds } = parseADVData(text);
      
      if (orders.length === 0) {
        setAreaState({
          text,
          status: 'error',
          message: 'Nenhum item encontrado',
          data: [],
        });
        return null;
      }
      
      setAreaState({
        text,
        status: 'success',
        message: `${orders.length} pedidos com itens`,
        data: orders,
        detectedType: 'adv',
      });
      
      toast({
        title: 'Relatório ADV detectado!',
        description: `${orders.length} pedidos com itens`,
      });
      
      return { type: 'adv', data: orders };
    }
    
    // Formato genérico - usar parser existente
    const result = parsePastedData(text);
    
    if (result.validRows === 0) {
      setAreaState({
        text,
        status: 'error',
        message: result.errors[0]?.message || 'Formato não reconhecido',
        data: [],
      });
      return null;
    }
    
    setAreaState({
      text,
      status: 'success',
      message: `${result.validRows} pedidos detectados`,
      data: result.orders,
      detectedType: 'generic',
    });
    
    return { type: 'generic', data: result.orders };
  }, [toast]);
  
  // Tentar cruzar dados
  const tryMerge = useCallback(() => {
    if (area1.status !== 'success' || area2.status !== 'success') return;
    
    let itinerarioRecords: any[] | null = null;
    let advOrders: ParsedOrder[] | null = null;
    
    if (area1.detectedType === 'itinerario') {
      itinerarioRecords = area1.data;
    } else if (area1.detectedType === 'adv') {
      advOrders = area1.data;
    }
    
    if (area2.detectedType === 'itinerario') {
      itinerarioRecords = area2.data;
    } else if (area2.detectedType === 'adv') {
      advOrders = area2.data;
    }
    
    // Se temos ambos, fazer cruzamento
    if (itinerarioRecords && advOrders) {
      console.log('[DualPasteData] Cruzando dados...');
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
  }, [area1, area2, toast]);
  
  // Efeito para cruzar automaticamente
  useEffect(() => {
    tryMerge();
  }, [area1.status, area2.status, tryMerge]);
  
  // Handlers
  const handleArea1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMergedOrders(null);
    setMergeSummary(null);
    processText(text, 1, setArea1);
  };
  
  const handleArea2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMergedOrders(null);
    setMergeSummary(null);
    processText(text, 2, setArea2);
  };
  
  const handlePasteFromClipboard = async (areaNum: 1 | 2) => {
    try {
      const text = await navigator.clipboard.readText();
      if (areaNum === 1) {
        setMergedOrders(null);
        setMergeSummary(null);
        processText(text, 1, setArea1);
      } else {
        setMergedOrders(null);
        setMergeSummary(null);
        processText(text, 2, setArea2);
      }
      toast({ title: 'Dados colados!' });
    } catch (error) {
      toast({
        title: 'Erro ao colar',
        description: 'Não foi possível acessar a área de transferência',
        variant: 'destructive',
      });
    }
  };
  
  const handleClear = (areaNum: 1 | 2) => {
    if (areaNum === 1) {
      setArea1({ text: '', status: 'idle', message: '', data: [] });
    } else {
      setArea2({ text: '', status: 'idle', message: '', data: [] });
    }
    setMergedOrders(null);
    setMergeSummary(null);
  };
  
  const handleImport = () => {
    // Se tem dados cruzados
    if (mergedOrders && mergedOrders.length > 0) {
      const validOrders = mergedOrders.filter(o => o.isValid);
      if (validOrders.length > 0) {
        onParsed(validOrders);
        return;
      }
    }
    
    // Se só tem itinerário
    if (area1.detectedType === 'itinerario' && area1.data.length > 0) {
      const orders: ParsedOrder[] = area1.data.map((r: any) => ({
        pedido_id: r.pedido_id,
        client_name: r.client_name,
        address: r.address,
        weight_kg: r.weight_kg || 0,
        items: [],
        isValid: Boolean(r.address && r.address !== 'Endereço não informado'),
      }));
      const valid = orders.filter(o => o.isValid);
      if (valid.length > 0) {
        onParsed(valid);
        return;
      }
    }
    
    if (area2.detectedType === 'itinerario' && area2.data.length > 0) {
      const orders: ParsedOrder[] = area2.data.map((r: any) => ({
        pedido_id: r.pedido_id,
        client_name: r.client_name,
        address: r.address,
        weight_kg: r.weight_kg || 0,
        items: [],
        isValid: Boolean(r.address && r.address !== 'Endereço não informado'),
      }));
      const valid = orders.filter(o => o.isValid);
      if (valid.length > 0) {
        onParsed(valid);
        return;
      }
    }
    
    // Se tem genérico
    if (area1.detectedType === 'generic' && area1.data.length > 0) {
      const valid = area1.data.filter((o: ParsedOrder) => o.isValid);
      if (valid.length > 0) {
        onParsed(valid);
        return;
      }
    }
    
    if (area2.detectedType === 'generic' && area2.data.length > 0) {
      const valid = area2.data.filter((o: ParsedOrder) => o.isValid);
      if (valid.length > 0) {
        onParsed(valid);
        return;
      }
    }
    
    // Alertar se só ADV
    if ((area1.detectedType === 'adv' || area2.detectedType === 'adv') && !mergedOrders) {
      toast({
        title: 'Dados incompletos',
        description: 'O relatório ADV não tem endereços. Cole também o itinerário.',
        variant: 'destructive',
      });
      return;
    }
    
    toast({
      title: 'Nenhum dado válido',
      description: 'Cole dados válidos em pelo menos uma área',
      variant: 'destructive',
    });
  };
  
  // Calcular se pode importar
  const canImport = 
    (mergedOrders && mergedOrders.filter(o => o.isValid).length > 0) ||
    (area1.status === 'success' && (area1.detectedType === 'itinerario' || area1.detectedType === 'generic')) ||
    (area2.status === 'success' && (area2.detectedType === 'itinerario' || area2.detectedType === 'generic'));
  
  const importCount = mergedOrders 
    ? mergedOrders.filter(o => o.isValid).length
    : area1.detectedType === 'itinerario' 
      ? area1.data.filter((r: any) => r.address && r.address !== 'Endereço não informado').length
      : area2.detectedType === 'itinerario'
        ? area2.data.filter((r: any) => r.address && r.address !== 'Endereço não informado').length
        : area1.detectedType === 'generic'
          ? area1.data.filter((o: ParsedOrder) => o.isValid).length
          : area2.detectedType === 'generic'
            ? area2.data.filter((o: ParsedOrder) => o.isValid).length
            : 0;

  // Helpers para labels
  const getAreaIcon = (area: PasteAreaState) => {
    if (area.detectedType === 'itinerario') return <MapPin className="h-5 w-5 text-primary" />;
    if (area.detectedType === 'adv') return <Package className="h-5 w-5 text-primary" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };
  
  const getAreaLabel = (area: PasteAreaState, defaultLabel: string) => {
    if (area.detectedType === 'itinerario') return 'Itinerário (Endereços)';
    if (area.detectedType === 'adv') return 'Relatório ADV (Itens)';
    if (area.detectedType === 'generic') return 'Dados de Pedidos';
    return defaultLabel;
  };
  
  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <ClipboardPaste className="h-4 w-4" />
        <AlertDescription>
          <strong>Cruzamento Manual:</strong> Cole os dados do <strong>Itinerário de Vendas</strong> (endereços) 
          e do <strong>Relatório ADV</strong> (itens) nas áreas abaixo. O sistema cruzará automaticamente pelo número da venda.
        </AlertDescription>
      </Alert>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Área 1 */}
        <Card className={cn(
          'transition-all',
          area1.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getAreaIcon(area1)}
              {getAreaLabel(area1, '1. Itinerário de Vendas')}
              {area1.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Cole dados com endereços de entrega
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => handlePasteFromClipboard(1)}
              >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Colar
              </Button>
              {area1.text && (
                <Button variant="ghost" size="icon" onClick={() => handleClear(1)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Textarea
              placeholder="Cole os dados aqui...&#10;&#10;Ex: Venda  Cliente  End. Ent.  Bairro Ent.  ..."
              value={area1.text}
              onChange={handleArea1Change}
              className={cn(
                'min-h-[150px] font-mono text-xs',
                area1.status === 'success' && 'border-success/50',
                area1.status === 'error' && 'border-destructive/50'
              )}
            />
            
            {/* Status */}
            {area1.status === 'parsing' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                {area1.message}
              </div>
            )}
            
            {area1.status === 'success' && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {area1.message}
              </div>
            )}
            
            {area1.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {area1.message}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Área 2 */}
        <Card className={cn(
          'transition-all',
          area2.status === 'success' && 'ring-2 ring-success/50'
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {getAreaIcon(area2)}
              {getAreaLabel(area2, '2. Relatório ADV')}
              {area2.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-success ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Cole dados com itens detalhados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => handlePasteFromClipboard(2)}
              >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Colar
              </Button>
              {area2.text && (
                <Button variant="ghost" size="icon" onClick={() => handleClear(2)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Textarea
              placeholder="Cole os dados aqui...&#10;&#10;Ex: Venda  Produto  Qtd  Peso  ..."
              value={area2.text}
              onChange={handleArea2Change}
              className={cn(
                'min-h-[150px] font-mono text-xs',
                area2.status === 'success' && 'border-success/50',
                area2.status === 'error' && 'border-destructive/50'
              )}
            />
            
            {/* Status */}
            {area2.status === 'parsing' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                {area2.message}
              </div>
            )}
            
            {area2.status === 'success' && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {area2.message}
              </div>
            )}
            
            {area2.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {area2.message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Merge Summary */}
      {mergeSummary && (
        <Alert className="bg-primary/5 border-primary/30">
          <Link2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Cruzamento concluído:</strong>{' '}
              <Badge variant="default" className="ml-2">{mergeSummary.matched} cruzados</Badge>
              {mergeSummary.unmatched > 0 && (
                <Badge variant="outline" className="ml-2">{mergeSummary.unmatched} sem match</Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Import Button */}
      {canImport && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleImport}>
            <CheckCircle2 className="mr-2 h-5 w-5" />
            Importar {importCount} Pedidos
          </Button>
        </div>
      )}
    </div>
  );
}
