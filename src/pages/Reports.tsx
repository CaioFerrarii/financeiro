import { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as ReLineChart, Line, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category_id: string | null;
  tax_amount: number | null;
  product_cost: number | null;
  categories?: {
    name: string;
    color: string;
  };
}

interface DREData {
  grossRevenue: number;
  taxes: number;
  productCosts: number;
  operationalExpenses: number;
  netProfit: number;
}

interface CashFlowData {
  month: string;
  income: number;
  expense: number;
  balance: number;
  accumulated: number;
}

interface CategoryData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export default function Reports() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { companyId, isReady } = useRequireCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [dreData, setDreData] = useState<DREData | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);

  useEffect(() => {
    if (isReady && companyId) {
      fetchTransactions();
    }
  }, [isReady, companyId, selectedYear, selectedMonth]);

  const fetchTransactions = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const yearStart = startOfYear(new Date(parseInt(selectedYear), 0));
      const yearEnd = endOfYear(new Date(parseInt(selectedYear), 0));

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
        .gte('date', format(yearStart, 'yyyy-MM-dd'))
        .lte('date', format(yearEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      const typedData = (data || []).map(t => ({
        ...t,
        type: t.type as 'income' | 'expense'
      }));
      
      setTransactions(typedData);
      calculateReports(typedData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateReports = (data: Transaction[]) => {
    // Filter for selected month for DRE
    const monthStart = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
    const monthEnd = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
    
    const monthTransactions = data.filter(t => {
      const date = new Date(t.date);
      return date >= monthStart && date <= monthEnd;
    });

    // Calculate DRE
    const grossRevenue = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const taxes = monthTransactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
    const productCosts = monthTransactions.reduce((sum, t) => sum + (t.product_cost || 0), 0);
    const operationalExpenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netProfit = grossRevenue - taxes - productCosts - operationalExpenses;

    setDreData({
      grossRevenue,
      taxes,
      productCosts,
      operationalExpenses,
      netProfit,
    });

    // Calculate Cash Flow (monthly)
    const monthlyData: CashFlowData[] = [];
    let accumulated = 0;

    for (let i = 0; i < 12; i++) {
      const mStart = startOfMonth(new Date(parseInt(selectedYear), i));
      const mEnd = endOfMonth(new Date(parseInt(selectedYear), i));
      
      const monthTx = data.filter(t => {
        const date = new Date(t.date);
        return date >= mStart && date <= mEnd;
      });

      const income = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const balance = income - expense;
      accumulated += balance;

      monthlyData.push({
        month: format(mStart, 'MMM', { locale: ptBR }),
        income,
        expense,
        balance,
        accumulated,
      });
    }
    setCashFlowData(monthlyData);

    // Calculate Category breakdown (ABC Curve)
    const categoryTotals: Record<string, { name: string; value: number; color: string }> = {};
    
    monthTransactions.forEach(t => {
      const catName = t.categories?.name || 'Sem categoria';
      const catColor = t.categories?.color || '#888888';
      
      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { name: catName, value: 0, color: catColor };
      }
      categoryTotals[catName].value += t.amount;
    });

    const sortedCategories = Object.values(categoryTotals)
      .sort((a, b) => b.value - a.value);
    
    const totalValue = sortedCategories.reduce((sum, c) => sum + c.value, 0);
    
    const categoryWithPercentage = sortedCategories.map((c, i) => ({
      ...c,
      percentage: totalValue > 0 ? (c.value / totalValue) * 100 : 0,
      color: c.color || CHART_COLORS[i % CHART_COLORS.length],
    }));

    setCategoryData(categoryWithPercentage);

    // Year-over-year comparison
    const currentYearTotal = data.reduce((sum, t) => 
      sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    
    setComparisonData([
      { name: selectedYear, value: currentYearTotal }
    ]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: format(new Date(2024, i), 'MMMM', { locale: ptBR }),
  }));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Análises financeiras e relatórios avançados
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="dre" className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-2 h-auto p-1">
          <TabsTrigger value="dre" className="gap-2">
            <FileText className="h-4 w-4" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2">
            <LineChart className="h-4 w-4" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="abc" className="gap-2">
            <PieChart className="h-4 w-4" />
            Curva ABC
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparativos
          </TabsTrigger>
        </TabsList>

        {/* DRE Tab */}
        <TabsContent value="dre">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">
              Demonstração do Resultado do Exercício - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </h2>
            
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : dreData ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="font-medium">Receita Bruta</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(dreData.grossRevenue)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b pl-4">
                  <span className="text-muted-foreground">(-) Impostos</span>
                  <span className="text-destructive">
                    {formatCurrency(dreData.taxes)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b pl-4">
                  <span className="text-muted-foreground">(-) Custo de Mercadorias</span>
                  <span className="text-destructive">
                    {formatCurrency(dreData.productCosts)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b pl-4">
                  <span className="text-muted-foreground">(-) Despesas Operacionais</span>
                  <span className="text-destructive">
                    {formatCurrency(dreData.operationalExpenses)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-4 bg-muted/50 rounded-lg px-4 mt-4">
                  <span className="text-lg font-semibold">Lucro Líquido</span>
                  <span className={`text-xl font-bold ${dreData.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(dreData.netProfit)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Fluxo de Caixa - {selectedYear}</h2>
            
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <div className="h-80 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Receitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-60">
                  <h3 className="text-sm font-medium mb-4">Saldo Acumulado</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <ReLineChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="accumulated" 
                        name="Acumulado"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* ABC Curve Tab */}
        <TabsContent value="abc">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Curva ABC por Categoria</h2>
              
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : categoryData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6">Ranking por Categoria</h2>
              
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : categoryData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>Classe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.map((cat, index) => {
                      let accumulatedPercentage = 0;
                      for (let i = 0; i <= index; i++) {
                        accumulatedPercentage += categoryData[i].percentage;
                      }
                      const abcClass = accumulatedPercentage <= 80 ? 'A' : accumulatedPercentage <= 95 ? 'B' : 'C';
                      
                      return (
                        <TableRow key={cat.name}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(cat.value)}
                          </TableCell>
                          <TableCell className="text-right">
                            {cat.percentage.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              abcClass === 'A' ? 'bg-primary/10 text-primary' :
                              abcClass === 'B' ? 'bg-warning/10 text-warning' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {abcClass}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Comparativo Anual</h2>
            
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" name="Saldo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
