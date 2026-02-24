import { useState, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, Trash2, Package, Download, Search } from 'lucide-react';
import defaultSpreadsheet from '@/assets/unidade_de_medida.xlsx?url';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProductUnits } from '@/hooks/useProductUnits';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

const ABBREVIATION_MAP: Record<string, string> = {
  'un': 'unidade',
  'cx': 'caixa',
  'fd': 'fardo',
  'kg': 'kg',
  'pc': 'peca',
  'sc': 'saco',
  'dp': 'display',
  'pct': 'pacote',
  'lt': 'litro',
  'gf': 'garrafa',
  'g': 'g',
};

function resolveUnit(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  return ABBREVIATION_MAP[normalized] || normalized;
}

interface ParsedRow {
  product_name: string;
  unit_type: string;
}

export function ProductUnitsImporter() {
  const { units, loading, importProductUnits, deleteUnit, validUnits } = useProductUnits();
  const { toast } = useToast();
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUnits = useMemo(() => {
    if (!searchTerm.trim()) return units;
    const term = searchTerm.toLowerCase();
    return units.filter(u => u.product_name.toLowerCase().includes(term));
  }, [units, searchTerm]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
        
        // Auto-detect column order: if first column has short values matching known abbreviations, it's Unit|Product
        const isInverted = rows.slice(0, 10).filter(row => {
          const val = String(row[keys[0]] || '').trim().toLowerCase();
          return val.length <= 3 && val in ABBREVIATION_MAP;
        }).length >= Math.min(5, rows.length);

        const parsed: ParsedRow[] = rows
          .map(row => {
            const col1 = String(row[keys[0]] || '').trim();
            const col2 = String(row[keys[1]] || '').trim();
            return {
              product_name: isInverted ? col2 : col1,
              unit_type: resolveUnit(isInverted ? col1 : (col2 || 'kg')),
            };
          })
          .filter(r => r.product_name.length > 0);

        setPreview(parsed);
        toast({ title: `${parsed.length} produtos encontrados na planilha${isInverted ? ' (colunas invertidas detectadas)' : ''}` });
      } catch {
        toast({ title: 'Erro ao ler arquivo', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }, [toast]);

  const handleImport = async () => {
    if (preview.length === 0) return;
    setIsImporting(true);
    const result = await importProductUnits(preview);
    setIsImporting(false);
    setPreview([]);
    toast({
      title: `${result.success} unidades importadas com sucesso`,
    });
  };

  const handleImportDefault = useCallback(async () => {
    setIsImporting(true);
    try {
      const response = await fetch(defaultSpreadsheet);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      const keys = rows.length > 0 ? Object.keys(rows[0]) : [];

      const isInverted = rows.slice(0, 10).filter(row => {
        const val = String(row[keys[0]] || '').trim().toLowerCase();
        return val.length <= 3 && val in ABBREVIATION_MAP;
      }).length >= Math.min(5, rows.length);

      const parsed: ParsedRow[] = rows
        .map(row => {
          const col1 = String(row[keys[0]] || '').trim();
          const col2 = String(row[keys[1]] || '').trim();
          return {
            product_name: isInverted ? col2 : col1,
            unit_type: resolveUnit(isInverted ? col1 : (col2 || 'kg')),
          };
        })
        .filter(r => r.product_name.length > 0);

      const result = await importProductUnits(parsed);
      toast({ title: `${result.success} produtos importados da planilha padrão` });
    } catch {
      toast({ title: 'Erro ao importar planilha padrão', variant: 'destructive' });
    }
    setIsImporting(false);
  }, [importProductUnits, toast]);

  const handleDelete = async (id: string) => {
    await deleteUnit(id);
    toast({ title: 'Produto removido' });
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha de Unidades
          </CardTitle>
          <CardDescription>
            Envie um arquivo Excel/CSV com 2 colunas: Nome do Produto e Unidade de Medida.
            Unidades aceitas: {validUnits.join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para selecionar arquivo (.xlsx, .csv)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <div className="flex justify-center mt-3">
            <Button variant="outline" onClick={handleImportDefault} disabled={isImporting} className="gap-2">
              <Download className="h-4 w-4" />
              {isImporting ? 'Importando...' : 'Importar Planilha Padrão (364 produtos)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview ({preview.length} produtos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.product_name}</TableCell>
                      <TableCell>
                        <Badge variant={validUnits.includes(row.unit_type) ? 'default' : 'destructive'}>
                          {row.unit_type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        ...e mais {preview.length - 50} produtos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Importando...' : `Salvar ${preview.length} produtos`}
              </Button>
              <Button variant="outline" onClick={() => setPreview([])}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Units */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5" />
            Produtos Cadastrados ({units.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : units.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum produto cadastrado. Importe uma planilha acima.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="w-[80px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.map(unit => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">{unit.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{unit.unit_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(unit.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUnits.length === 0 && searchTerm && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhum produto encontrado para "{searchTerm}"
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
