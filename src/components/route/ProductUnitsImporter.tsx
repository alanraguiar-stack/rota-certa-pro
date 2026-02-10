import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProductUnits } from '@/hooks/useProductUnits';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ParsedRow {
  product_name: string;
  unit_type: string;
}

export function ProductUnitsImporter() {
  const { units, loading, importProductUnits, deleteUnit, validUnits } = useProductUnits();
  const { toast } = useToast();
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

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

        const parsed: ParsedRow[] = rows
          .map(row => {
            const keys = Object.keys(row);
            return {
              product_name: String(row[keys[0]] || '').trim(),
              unit_type: String(row[keys[1]] || 'kg').trim().toLowerCase(),
            };
          })
          .filter(r => r.product_name.length > 0);

        setPreview(parsed);
        toast({ title: `${parsed.length} produtos encontrados na planilha` });
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
                  {units.map(unit => (
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
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
