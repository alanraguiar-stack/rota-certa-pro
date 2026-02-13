import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, History, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ParsedHistoryRow {
  sequence_order: number;
  sale_number: string;
  client_name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface HistoryImport {
  truck_label: string;
  route_date: string | null;
  rows: ParsedHistoryRow[];
}

interface StoredPattern {
  id: string;
  truck_label: string;
  route_date: string | null;
  city: string;
  sequence_order: number;
  client_name: string;
  created_at: string;
}

export function RouteHistoryImporter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<HistoryImport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [patterns, setPatterns] = useState<StoredPattern[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadPatterns = useCallback(async () => {
    if (!user) return;
    setLoadingPatterns(true);
    const { data } = await supabase
      .from('route_history_patterns')
      .select('id, truck_label, route_date, city, sequence_order, client_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setPatterns((data as StoredPattern[]) || []);
    setLoadingPatterns(false);
    setLoaded(true);
  }, [user]);

  // Load on first render
  if (!loaded && user) {
    loadPatterns();
  }

  const extractTruckLabel = (filename: string): string => {
    // Extract truck identifier from filename like "CYR10.02.26.xls" -> "CYR"
    const match = filename.match(/^([A-Z]{2,5})/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  };

  const extractRouteDate = (filename: string): string | null => {
    // Extract date from filename like "CYR10.02.26.xls" -> "2026-02-10"
    const match = filename.match(/(\d{2})\.(\d{2})\.(\d{2})/);
    if (!match) return null;
    const [, dd, mm, yy] = match;
    const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
    return `${year}-${mm}-${dd}`;
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const truckLabel = extractTruckLabel(file.name);
    const routeDate = extractRouteDate(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        // Find the header row with "Ordem", "Venda", etc.
        let headerIdx = -1;
        for (let i = 0; i < Math.min(20, rawRows.length); i++) {
          const row = rawRows[i];
          if (row && row.some(cell => String(cell || '').trim().toLowerCase() === 'ordem')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          toast({ title: 'Formato não reconhecido. Esperado: planilha "Entregas" do ERP.', variant: 'destructive' });
          return;
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        const colIdx = {
          ordem: headers.indexOf('ordem'),
          venda: headers.indexOf('venda'),
          cliente: headers.indexOf('cliente'),
          fantasia: headers.indexOf('fantasia'),
          cep: headers.indexOf('cep'),
          endereco: headers.indexOf('endereço') !== -1 ? headers.indexOf('endereço') : headers.indexOf('endereco'),
          numero: headers.indexOf('número') !== -1 ? headers.indexOf('número') : headers.indexOf('numero'),
          bairro: headers.indexOf('bairro'),
          cidade: headers.indexOf('cidade'),
          uf: headers.indexOf('uf'),
        };

        const rows: ParsedHistoryRow[] = [];
        for (let i = headerIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const ordem = colIdx.ordem >= 0 ? String(row[colIdx.ordem] || '').trim() : '';
          const venda = colIdx.venda >= 0 ? String(row[colIdx.venda] || '').trim() : '';
          const cliente = colIdx.cliente >= 0 ? String(row[colIdx.cliente] || '').trim() : '';
          const cidade = colIdx.cidade >= 0 ? String(row[colIdx.cidade] || '').trim() : '';

          // Skip empty rows and totals
          if (!cliente && !venda) continue;
          if (cliente.toLowerCase().includes('total')) continue;

          const endereco = colIdx.endereco >= 0 ? String(row[colIdx.endereco] || '').trim() : '';
          const numero = colIdx.numero >= 0 ? String(row[colIdx.numero] || '').trim() : '';
          const bairro = colIdx.bairro >= 0 ? String(row[colIdx.bairro] || '').trim() : '';
          const uf = colIdx.uf >= 0 ? String(row[colIdx.uf] || '').trim() : '';

          const fullAddress = [endereco, numero, bairro, cidade, uf].filter(Boolean).join(', ');

          rows.push({
            sequence_order: parseInt(ordem) || rows.length + 1,
            sale_number: venda,
            client_name: cliente,
            address: fullAddress,
            neighborhood: bairro,
            city: cidade,
            state: uf,
          });
        }

        if (rows.length === 0) {
          toast({ title: 'Nenhuma entrega encontrada no arquivo', variant: 'destructive' });
          return;
        }

        setPreview({ truck_label: truckLabel, route_date: routeDate, rows });
        toast({ title: `${rows.length} entregas de ${truckLabel} encontradas` });
      } catch {
        toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, [toast]);

  const handleImport = async () => {
    if (!preview || !user) return;
    setIsImporting(true);

    const records = preview.rows.map(row => ({
      user_id: user.id,
      truck_label: preview.truck_label,
      route_date: preview.route_date,
      sequence_order: row.sequence_order,
      sale_number: row.sale_number,
      client_name: row.client_name,
      address: row.address,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    }));

    const { error } = await supabase
      .from('route_history_patterns')
      .insert(records);

    if (error) {
      toast({ title: 'Erro ao salvar histórico', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${records.length} entregas de ${preview.truck_label} salvas no histórico` });
      setPreview(null);
      loadPatterns();
    }
    setIsImporting(false);
  };

  const handleDeleteByTruck = async (truckLabel: string, routeDate: string | null) => {
    if (!user) return;
    let query = supabase
      .from('route_history_patterns')
      .delete()
      .eq('user_id', user.id)
      .eq('truck_label', truckLabel);

    if (routeDate) {
      query = query.eq('route_date', routeDate);
    }

    const { error } = await query;
    if (error) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } else {
      toast({ title: `Roteiro ${truckLabel} removido` });
      loadPatterns();
    }
  };

  // Group stored patterns by truck+date
  const groupedPatterns = patterns.reduce<Record<string, { truckLabel: string; routeDate: string | null; count: number; cities: string[] }>>((acc, p) => {
    const key = `${p.truck_label}_${p.route_date || 'sem_data'}`;
    if (!acc[key]) {
      acc[key] = { truckLabel: p.truck_label, routeDate: p.route_date, count: 0, cities: [] };
    }
    acc[key].count++;
    if (p.city && !acc[key].cities.includes(p.city)) {
      acc[key].cities.push(p.city);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Importar Roteiro do Analista
          </CardTitle>
          <CardDescription>
            Envie arquivos .xls de roteiros feitos manualmente. O sistema aprende os padrões de agrupamento por cidade e caminhão.
            O nome do arquivo deve conter o identificador do caminhão (ex: CYR10.02.26.xls).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para selecionar arquivo de roteiro (.xls)</span>
            <input
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Roteiro: {preview.truck_label} {preview.route_date ? `(${preview.route_date})` : ''}
            </CardTitle>
            <CardDescription>{preview.rows.length} entregas encontradas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {[...new Set(preview.rows.map(r => r.city).filter(Boolean))].map(city => (
                <Badge key={city} variant="secondary">{city}</Badge>
              ))}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Seq</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Bairro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.sequence_order}</TableCell>
                      <TableCell className="font-medium">{row.client_name}</TableCell>
                      <TableCell>{row.city}</TableCell>
                      <TableCell className="text-muted-foreground">{row.neighborhood}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Salvando...' : `Salvar ${preview.rows.length} entregas`}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stored Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            Roteiros Importados ({Object.keys(groupedPatterns).length})
          </CardTitle>
          <CardDescription>
            Esses padrões são usados pelo motor de roteamento para aprender a composição ideal de cada caminhão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPatterns ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : Object.keys(groupedPatterns).length === 0 ? (
            <div className="text-center text-muted-foreground py-8 space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto opacity-50" />
              <p>Nenhum roteiro importado ainda.</p>
              <p className="text-xs">Importe roteiros do analista para que o sistema aprenda os padrões.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedPatterns).map(([key, group]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge>{group.truckLabel}</Badge>
                      {group.routeDate && <span className="text-sm text-muted-foreground">{group.routeDate}</span>}
                      <span className="text-sm">{group.count} entregas</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.cities.map(city => (
                        <Badge key={city} variant="outline" className="text-xs">{city}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteByTruck(group.truckLabel, group.routeDate)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
