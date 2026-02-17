import { useState, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, Trash2, History, AlertCircle, X } from 'lucide-react';
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
  filename: string;
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
  const [previews, setPreviews] = useState<HistoryImport[]>([]);
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

  useEffect(() => {
    if (!loaded && user) {
      loadPatterns();
    }
  }, [user, loaded, loadPatterns]);

  const extractTruckLabel = (filename: string): string => {
    const match = filename.match(/^([A-Z]{2,5})/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  };

  const extractRouteDate = (filename: string): string | null => {
    // Try DD.MM.YY first
    const match3 = filename.match(/(\d{2})\.(\d{2})\.(\d{2})/);
    if (match3) {
      const [, dd, mm, yy] = match3;
      const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
      return `${year}-${mm}-${dd}`;
    }
    // Try DD.MM (no year, assume current year)
    const match2 = filename.match(/(\d{2})\.(\d{2})/);
    if (match2) {
      const [, dd, mm] = match2;
      const year = new Date().getFullYear();
      return `${year}-${mm}-${dd}`;
    }
    return null;
  };

  const extractDateFromColumn = (rawRows: any[][], headers: string[], headerIdx: number): string | null => {
    const fechIdx = headers.findIndex(h => h.includes('fechamento'));
    if (fechIdx < 0) return null;
    for (let i = headerIdx + 1; i < Math.min(headerIdx + 5, rawRows.length); i++) {
      const val = String(rawRows[i]?.[fechIdx] || '').trim();
      // DD/MM/YYYY
      const m = val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      // Excel serial date
      if (/^\d{5}$/.test(val)) {
        const d = XLSX.SSF.parse_date_code(parseInt(val));
        if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const parseFile = (file: File): Promise<HistoryImport | null> => {
    return new Promise((resolve) => {
      const truckLabel = extractTruckLabel(file.name);
      let routeDate = extractRouteDate(file.name);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

          let headerIdx = -1;
          for (let i = 0; i < Math.min(20, rawRows.length); i++) {
            const row = rawRows[i];
            if (row && row.some(cell => String(cell || '').trim().toLowerCase() === 'ordem')) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) {
            resolve(null);
            return;
          }

          const headers = rawRows[headerIdx].map(h => String(h || '').trim().toLowerCase());

          // Fallback: extract date from "Fechamento" column
          if (!routeDate) {
            routeDate = extractDateFromColumn(rawRows, headers, headerIdx);
          }

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

            const venda = colIdx.venda >= 0 ? String(row[colIdx.venda] || '').trim() : '';
            const cliente = colIdx.cliente >= 0 ? String(row[colIdx.cliente] || '').trim() : '';

            if (!cliente && !venda) continue;
            if (cliente.toLowerCase().includes('total')) continue;

            const ordem = colIdx.ordem >= 0 ? String(row[colIdx.ordem] || '').trim() : '';
            const endereco = colIdx.endereco >= 0 ? String(row[colIdx.endereco] || '').trim() : '';
            const numero = colIdx.numero >= 0 ? String(row[colIdx.numero] || '').trim() : '';
            const bairro = colIdx.bairro >= 0 ? String(row[colIdx.bairro] || '').trim() : '';
            const cidade = colIdx.cidade >= 0 ? String(row[colIdx.cidade] || '').trim() : '';
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
            resolve(null);
            return;
          }

          resolve({ truck_label: truckLabel, route_date: routeDate, rows, filename: file.name });
        } catch {
          resolve(null);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const results: HistoryImport[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      const result = await parseFile(file);
      if (result) {
        results.push(result);
      } else {
        errors.push(file.name);
      }
    }

    if (errors.length > 0) {
      toast({ title: `Formato não reconhecido: ${errors.join(', ')}`, variant: 'destructive' });
    }
    if (results.length > 0) {
      setPreviews(prev => [...prev, ...results]);
      const total = results.reduce((s, r) => s + r.rows.length, 0);
      toast({ title: `${total} entregas encontradas em ${results.length} arquivo(s)` });
    }

    e.target.value = '';
  }, [toast]);

  const handleImportOne = async (index: number) => {
    if (!user) return;
    const item = previews[index];
    if (!item) return;
    setIsImporting(true);

    const records = item.rows.map(row => ({
      user_id: user.id,
      truck_label: item.truck_label,
      route_date: item.route_date,
      sequence_order: row.sequence_order,
      sale_number: row.sale_number,
      client_name: row.client_name,
      address: row.address,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    }));

    const { error } = await supabase.from('route_history_patterns').insert(records);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${records.length} entregas de ${item.truck_label} salvas` });
      setPreviews(prev => prev.filter((_, i) => i !== index));
      loadPatterns();
    }
    setIsImporting(false);
  };

  const handleImportAll = async () => {
    if (!user || previews.length === 0) return;
    setIsImporting(true);

    const allRecords = previews.flatMap(item =>
      item.rows.map(row => ({
        user_id: user.id,
        truck_label: item.truck_label,
        route_date: item.route_date,
        sequence_order: row.sequence_order,
        sale_number: row.sale_number,
        client_name: row.client_name,
        address: row.address,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
      }))
    );

    const { error } = await supabase.from('route_history_patterns').insert(allRecords);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${allRecords.length} entregas de ${previews.length} roteiro(s) salvas` });
      setPreviews([]);
      loadPatterns();
    }
    setIsImporting(false);
  };

  const removePreview = (index: number) => {
    setPreviews(prev => prev.filter((_, i) => i !== index));
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
            Envie um ou mais arquivos .xls/.xlsx de roteiros feitos manualmente. O sistema aprende os padrões de agrupamento por cidade e caminhão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para selecionar arquivos de roteiro (.xls, .xlsx)</span>
            <input
              type="file"
              accept=".xls,.xlsx"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </CardContent>
      </Card>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="space-y-4">
          {previews.length > 1 && (
            <div className="flex justify-end">
              <Button onClick={handleImportAll} disabled={isImporting}>
                {isImporting ? 'Salvando...' : `Salvar Todos (${previews.reduce((s, p) => s + p.rows.length, 0)} entregas)`}
              </Button>
            </div>
          )}
          {previews.map((preview, idx) => (
            <Card key={`${preview.filename}-${idx}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {preview.truck_label} {preview.route_date ? `(${preview.route_date})` : '(sem data)'}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePreview(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>{preview.filename} — {preview.rows.length} entregas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  {[...new Set(preview.rows.map(r => r.city).filter(Boolean))].map(city => (
                    <Badge key={city} variant="secondary">{city}</Badge>
                  ))}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
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
                      {preview.rows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          <TableCell>{row.sequence_order}</TableCell>
                          <TableCell className="font-medium">{row.client_name}</TableCell>
                          <TableCell>{row.city}</TableCell>
                          <TableCell className="text-muted-foreground">{row.neighborhood}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button size="sm" onClick={() => handleImportOne(idx)} disabled={isImporting}>
                  Salvar {preview.rows.length} entregas
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
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
