import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { useToast } from '@/hooks/use-toast';
import { useAlerts } from '@/hooks/useAlerts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  Calendar,
  History,
  AlertCircle,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportHistory {
  id: string;
  file_name: string;
  format: string;
  export_type: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: string;
  source: string | null;
  notes: string | null;
  subcategory: string | null;
  tax_amount: number;
  product_cost: number;
  profit: number;
  origin: string;
  categories: {
    name: string;
    color: string;
  } | null;
}

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type ExportFormat = 'csv' | 'xlsx';
type ExportType = 'transactions' | 'monthly_summary' | 'category_summary' | 'full_report';

export default function Export() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { companyId, isReady } = useRequireCompany();
  const { toast } = useToast();
  const { createAlert } = useAlerts();
  const [loading, setLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportType, setExportType] = useState<ExportType>('transactions');

  useEffect(() => {
    if (isReady && companyId) {
      fetchExportHistory();
    }
  }, [isReady, companyId]);

  const fetchExportHistory = async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('export_history')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setExportHistory(data || []);
    } catch (error) {
      console.error('Error fetching export history:', error);
    }
  };

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    
    switch (periodType) {
      case 'today':
        return { start: now, end: now };
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: subMonths(startOfMonth(now), 2), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : now,
          end: customEndDate ? new Date(customEndDate) : now,
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const fetchTransactions = async (startDate: Date, endDate: Date): Promise<Transaction[]> => {
    if (!companyId) return [];
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          color
        )
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const formatTransactionsForExport = (transactions: Transaction[]) => {
    return transactions.map(t => ({
      'Data': format(new Date(t.date), 'dd/MM/yyyy'),
      'Descrição': t.description,
      'Categoria': t.categories?.name || '-',
      'Subcategoria': t.subcategory || '-',
      'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
      'Valor': t.amount,
      'Imposto': t.tax_amount || 0,
      'Custo': t.product_cost || 0,
      'Lucro': t.profit || 0,
      'Origem': t.origin || 'manual',
      'Fonte': t.source || '-',
      'Observações': t.notes || '-',
    }));
  };

  const generateMonthlySummary = (transactions: Transaction[]) => {
    const summary: Record<string, { income: number; expense: number; balance: number }> = {};
    
    transactions.forEach(t => {
      const monthKey = format(new Date(t.date), 'yyyy-MM');
      if (!summary[monthKey]) {
        summary[monthKey] = { income: 0, expense: 0, balance: 0 };
      }
      if (t.type === 'income') {
        summary[monthKey].income += t.amount;
      } else {
        summary[monthKey].expense += t.amount;
      }
      summary[monthKey].balance = summary[monthKey].income - summary[monthKey].expense;
    });

    return Object.entries(summary).map(([month, data]) => ({
      'Mês': format(new Date(month + '-01'), 'MMMM yyyy', { locale: ptBR }),
      'Receitas': data.income,
      'Despesas': data.expense,
      'Saldo': data.balance,
    }));
  };

  const generateCategorySummary = (transactions: Transaction[]) => {
    const summary: Record<string, { total: number; count: number; type: string }> = {};
    
    transactions.forEach(t => {
      const categoryName = t.categories?.name || 'Sem categoria';
      if (!summary[categoryName]) {
        summary[categoryName] = { total: 0, count: 0, type: t.type };
      }
      summary[categoryName].total += t.amount;
      summary[categoryName].count += 1;
    });

    return Object.entries(summary).map(([category, data]) => ({
      'Categoria': category,
      'Tipo': data.type === 'income' ? 'Receita' : 'Despesa',
      'Total': data.total,
      'Quantidade': data.count,
      'Média': data.total / data.count,
    }));
  };

  const generateFullReport = (transactions: Transaction[]) => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalTax = transactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
    const totalCost = transactions.reduce((sum, t) => sum + (t.product_cost || 0), 0);
    
    return [
      { 'Métrica': 'Receita Bruta', 'Valor': totalIncome },
      { 'Métrica': '(-) Impostos', 'Valor': totalTax },
      { 'Métrica': '(-) Custos de Mercadoria', 'Valor': totalCost },
      { 'Métrica': '(-) Despesas Operacionais', 'Valor': totalExpense },
      { 'Métrica': 'Lucro Líquido', 'Valor': totalIncome - totalTax - totalCost - totalExpense },
      { 'Métrica': 'Total de Transações', 'Valor': transactions.length },
    ];
  };

  const downloadFile = async (data: any[], fileName: string, exportFormat: ExportFormat) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dados');

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);
      
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      data.forEach(item => {
        worksheet.addRow(Object.values(item));
      });

      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    if (exportFormat === 'csv') {
      const csvContent = await workbook.csv.writeBuffer();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExport = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const transactions = await fetchTransactions(start, end);

      if (transactions.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Nenhuma transação encontrada no período selecionado.',
        });
        setLoading(false);
        return;
      }

      let data: any[];
      let fileName: string;

      switch (exportType) {
        case 'transactions':
          data = formatTransactionsForExport(transactions);
          fileName = `transacoes-${format(start, 'yyyy-MM-dd')}-a-${format(end, 'yyyy-MM-dd')}`;
          break;
        case 'monthly_summary':
          data = generateMonthlySummary(transactions);
          fileName = `resumo-mensal-${format(start, 'yyyy-MM-dd')}-a-${format(end, 'yyyy-MM-dd')}`;
          break;
        case 'category_summary':
          data = generateCategorySummary(transactions);
          fileName = `resumo-categorias-${format(start, 'yyyy-MM-dd')}-a-${format(end, 'yyyy-MM-dd')}`;
          break;
        case 'full_report':
          data = generateFullReport(transactions);
          fileName = `relatorio-completo-${format(start, 'yyyy-MM-dd')}-a-${format(end, 'yyyy-MM-dd')}`;
          break;
        default:
          data = formatTransactionsForExport(transactions);
          fileName = `exportacao-${format(new Date(), 'yyyy-MM-dd')}`;
      }

      await downloadFile(data, fileName, exportFormat);

      await supabase.from('export_history').insert({
        user_id: user?.id,
        company_id: companyId,
        file_name: `${fileName}.${exportFormat}`,
        format: exportFormat,
        export_type: exportType,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
      });

      await createAlert('export_completed', `Exportação concluída - Formato ${exportFormat.toUpperCase()}`, {
        file_name: `${fileName}.${exportFormat}`,
        format: exportFormat,
        export_type: exportType,
        rows_count: data.length,
      });

      toast({
        title: 'Sucesso',
        description: 'Exportação realizada com sucesso!',
      });

      fetchExportHistory();
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getExportTypeLabel = (type: string) => {
    switch (type) {
      case 'transactions': return 'Transações';
      case 'monthly_summary': return 'Resumo Mensal';
      case 'category_summary': return 'Por Categoria';
      case 'full_report': return 'Relatório Completo';
      default: return type;
    }
  };

  if (!company) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Empresa não configurada</h2>
          <p className="text-muted-foreground">
            Configure sua empresa para acessar esta funcionalidade.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Download className="h-8 w-8" />
          Exportar Dados
        </h1>
        <p className="text-muted-foreground">
          Exporte relatórios em CSV e XLSX
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nova Exportação</CardTitle>
            <CardDescription>
              Configure os parâmetros da exportação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                  <SelectTrigger>
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mês</SelectItem>
                    <SelectItem value="quarter">Último Trimestre</SelectItem>
                    <SelectItem value="year">Este Ano</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Exportação</Label>
                <Select value={exportType} onValueChange={(v) => setExportType(v as ExportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactions">Transações Brutas</SelectItem>
                    <SelectItem value="monthly_summary">Resumo Mensal</SelectItem>
                    <SelectItem value="category_summary">Resumo por Categoria</SelectItem>
                    <SelectItem value="full_report">Relatório Completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {periodType === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Formato</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={exportFormat === 'xlsx' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('xlsx')}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  XLSX (Excel)
                </Button>
                <Button
                  type="button"
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={loading}
              className="w-full gap-2"
              size="lg"
            >
              <Download className="h-5 w-5" />
              {loading ? 'Exportando...' : 'Exportar Dados'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico
            </CardTitle>
            <CardDescription>
              Últimas 5 exportações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exportHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma exportação realizada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {exportHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate max-w-[150px]">
                          {item.file_name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {item.format.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{getExportTypeLabel(item.export_type)}</span>
                      <span>
                        {format(new Date(item.created_at), "dd/MM/yy HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
