import { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { supabase } from '@/integrations/supabase/client';
import { useAlerts } from '@/hooks/useAlerts';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  category: string;
  taxAmount: string;
  productCost: string;
}

interface ImportHistoryItem {
  id: string;
  file_name: string;
  rows_imported: number;
  rows_failed: number;
  status: string;
  created_at: string;
}

export default function Import() {
  const { user } = useAuth();
  const { company, canEdit } = useCompany();
  const { companyId, isReady, requireCompany } = useRequireCompany();
  const { toast } = useToast();
  const { createAlert, checkDuplicates } = useAlerts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    category: '',
    taxAmount: '',
    productCost: '',
  });
  const [importing, setImporting] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');

  useEffect(() => {
    if (isReady && companyId) {
      fetchHistory();
    }
  }, [isReady, companyId]);

  const fetchHistory = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('import_history')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setImportHistory(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.csv') && 
        !selectedFile.name.endsWith('.xlsx') &&
        !selectedFile.name.endsWith('.xls')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo CSV ou XLSX.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const worksheet = workbook.addWorksheet('Sheet1');
        lines.forEach(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          worksheet.addRow(values);
        });
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast({
          title: 'Arquivo vazio',
          description: 'O arquivo não contém planilhas.',
          variant: 'destructive',
        });
        return;
      }

      const jsonData: any[][] = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values as any[];
        jsonData.push(rowValues.slice(1));
      });

      if (jsonData.length < 2) {
        toast({
          title: 'Arquivo vazio',
          description: 'O arquivo não contém dados suficientes.',
          variant: 'destructive',
        });
        return;
      }

      const headerRow = jsonData[0].map(h => String(h || ''));
      const dataRows = jsonData.slice(1, 6);

      setHeaders(headerRow);
      setPreviewData(dataRows);
      setStep('mapping');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Erro ao ler arquivo',
        description: 'Não foi possível processar o arquivo selecionado.',
        variant: 'destructive',
      });
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }));
  };

  const validateMapping = (): boolean => {
    if (!mapping.date || !mapping.description || !mapping.amount) {
      toast({
        title: 'Mapeamento incompleto',
        description: 'Os campos Data, Descrição e Valor são obrigatórios.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const proceedToPreview = () => {
    if (!validateMapping()) return;
    setStep('preview');
  };

  const parseAmount = (value: any): { amount: number; type: 'income' | 'expense' } => {
    if (typeof value === 'number') {
      return {
        amount: Math.abs(value),
        type: value >= 0 ? 'income' : 'expense',
      };
    }

    const strValue = String(value).replace(/[R$\s]/g, '').replace(',', '.');
    const numValue = parseFloat(strValue);
    
    return {
      amount: Math.abs(numValue),
      type: numValue >= 0 ? 'income' : 'expense',
    };
  };

  const parseDate = (value: any): string => {
    if (!value) return new Date().toISOString().split('T')[0];

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    const strValue = String(value);
    
    const brMatch = strValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }

    const isoMatch = strValue.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return strValue;
    }

    return new Date().toISOString().split('T')[0];
  };

  const handleImport = async () => {
    if (!file) return;
    
    let cId: string;
    let userId: string;
    try {
      const ctx = requireCompany();
      cId = ctx.companyId;
      userId = ctx.userId;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return;
    }

    setImporting(true);
    let rowsImported = 0;
    let rowsFailed = 0;
    const errors: string[] = [];

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const worksheet = workbook.addWorksheet('Sheet1');
        lines.forEach(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          worksheet.addRow(values);
        });
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('No worksheet found');

      const jsonData: any[][] = [];
      worksheet.eachRow((row) => {
        const rowValues = row.values as any[];
        jsonData.push(rowValues.slice(1));
      });
      
      const headerRow = jsonData[0].map(h => String(h || ''));
      const dataRows = jsonData.slice(1);

      const dateIdx = headerRow.indexOf(mapping.date);
      const descIdx = headerRow.indexOf(mapping.description);
      const amountIdx = headerRow.indexOf(mapping.amount);
      const categoryIdx = mapping.category ? headerRow.indexOf(mapping.category) : -1;
      const taxIdx = mapping.taxAmount ? headerRow.indexOf(mapping.taxAmount) : -1;
      const costIdx = mapping.productCost ? headerRow.indexOf(mapping.productCost) : -1;

      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('company_id', cId)
        .is('deleted_at', null);

      const categoryMap = new Map(categories?.map(c => [c.name.toLowerCase(), c.id]) || []);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0 || !row[descIdx]) continue;

        try {
          const { amount, type } = parseAmount(row[amountIdx]);
          const date = parseDate(row[dateIdx]);
          const description = String(row[descIdx] || '');
          const categoryName = categoryIdx >= 0 ? String(row[categoryIdx] || '') : '';
          
          let categoryId: string | null = null;
          if (categoryName) {
            const existingCategoryId = categoryMap.get(categoryName.toLowerCase());
            if (existingCategoryId) {
              categoryId = existingCategoryId;
            } else {
              const { data: newCategory, error: catError } = await supabase
                .from('categories')
                .insert({
                  user_id: userId,
                  company_id: cId,
                  name: categoryName,
                  color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
                })
                .select('id')
                .single();

              if (!catError && newCategory) {
                categoryId = newCategory.id;
                categoryMap.set(categoryName.toLowerCase(), categoryId);
              }
            }
          }

          const { isDuplicate, duplicateId } = await checkDuplicates(categoryId, amount, date);
          
          if (isDuplicate) {
            await createAlert('duplicate_detected', `Possível duplicidade detectada na importação`, {
              originalId: duplicateId,
              duplicateDescription: description,
              amount,
              date,
              type,
            });
          }

          const transactionData = {
            user_id: userId,
            company_id: cId,
            description,
            amount,
            type,
            date,
            category_id: categoryId,
            tax_amount: taxIdx >= 0 ? parseFloat(String(row[taxIdx] || 0)) || null : null,
            product_cost: costIdx >= 0 ? parseFloat(String(row[costIdx] || 0)) || null : null,
            origin: 'import',
          };

          const { error } = await supabase
            .from('transactions')
            .insert([transactionData]);

          if (error) throw error;
          rowsImported++;

        } catch (rowError: any) {
          rowsFailed++;
          errors.push(`Linha ${i + 2}: ${rowError.message}`);
        }
      }

      await supabase
        .from('import_history')
        .insert({
          user_id: userId,
          company_id: cId,
          file_name: file.name,
          rows_imported: rowsImported,
          rows_failed: rowsFailed,
          status: rowsFailed === 0 ? 'success' : 'partial',
          error_details: errors.length > 0 ? errors : null,
        });

      await createAlert('import_completed', `Importação concluída: ${file.name}`, {
        fileName: file.name,
        rowsImported,
        rowsFailed,
      });

      toast({
        title: 'Importação concluída',
        description: `${rowsImported} registros importados${rowsFailed > 0 ? `, ${rowsFailed} com erro` : ''}.`,
      });

      resetImport();
      fetchHistory();

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message || 'Ocorreu um erro durante a importação.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setMapping({
      date: '',
      description: '',
      amount: '',
      category: '',
      taxAmount: '',
      productCost: '',
    });
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!canEdit) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para importar dados.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Importar Dados
        </h1>
        <p className="text-muted-foreground">
          Importe planilhas CSV e XLSX para o sistema
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={step === 'upload' ? 'text-primary font-medium' : 'text-muted-foreground'}>
          1. Upload
        </span>
        <span className="text-muted-foreground">→</span>
        <span className={step === 'mapping' ? 'text-primary font-medium' : 'text-muted-foreground'}>
          2. Mapeamento
        </span>
        <span className="text-muted-foreground">→</span>
        <span className={step === 'preview' ? 'text-primary font-medium' : 'text-muted-foreground'}>
          3. Importar
        </span>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card className="p-8">
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-4 p-8 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Arraste ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">
                  Arquivos suportados: CSV, XLSX, XLS
                </p>
              </div>
            </label>
          </div>
        </Card>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {headers.length} colunas detectadas
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={resetImport}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Select value={mapping.date} onValueChange={(v) => handleMappingChange('date', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Select value={mapping.description} onValueChange={(v) => handleMappingChange('description', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor *</Label>
              <Select value={mapping.amount} onValueChange={(v) => handleMappingChange('amount', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={mapping.category} onValueChange={(v) => handleMappingChange('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Imposto</Label>
              <Select value={mapping.taxAmount} onValueChange={(v) => handleMappingChange('taxAmount', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custo do Produto</Label>
              <Select value={mapping.productCost} onValueChange={(v) => handleMappingChange('productCost', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview Table */}
          <div>
            <h3 className="text-sm font-medium mb-2">Prévia dos dados</h3>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      {headers.map((h, j) => (
                        <TableCell key={j} className="whitespace-nowrap">
                          {String(row[j] || '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetImport}>
              Cancelar
            </Button>
            <Button onClick={proceedToPreview}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {/* Preview/Import Step */}
      {step === 'preview' && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">Pronto para importar</p>
              <p className="text-sm text-muted-foreground">
                {file?.name} - Mapeamento configurado
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm"><strong>Data:</strong> {mapping.date}</p>
            <p className="text-sm"><strong>Descrição:</strong> {mapping.description}</p>
            <p className="text-sm"><strong>Valor:</strong> {mapping.amount}</p>
            {mapping.category && <p className="text-sm"><strong>Categoria:</strong> {mapping.category}</p>}
            {mapping.taxAmount && <p className="text-sm"><strong>Imposto:</strong> {mapping.taxAmount}</p>}
            {mapping.productCost && <p className="text-sm"><strong>Custo:</strong> {mapping.productCost}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              Voltar
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar Dados'
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Import History */}
      {importHistory.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Histórico de Importações</h2>
          <div className="space-y-3">
            {importHistory.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{item.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    <span className="text-primary">{item.rows_imported}</span> importados
                    {item.rows_failed > 0 && (
                      <span className="text-destructive ml-2">{item.rows_failed} falhas</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
