import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, Wallet, Target, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category?: {
    name: string;
    color: string;
  };
}

interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { company, canEdit } = useCompany();
  const { companyId, isReady } = useRequireCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
  });
  const [chartData, setChartData] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !companyId) return;
    
    fetchDashboardData();

    // Set up realtime subscription
    const channel = supabase
      .channel('dashboard-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isReady, companyId]);

  const fetchDashboardData = async () => {
    if (!companyId) return;
    
    try {
      // Fetch recent transactions with categories
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          amount,
          type,
          date,
          categories (
            name,
            color
          )
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(5);

      if (transactionsError) throw transactionsError;

      const formattedTransactions: Transaction[] = (transactionsData || []).map((t: any) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        type: t.type as 'income' | 'expense',
        date: t.date,
        category: t.categories ? {
          name: t.categories.name,
          color: t.categories.color,
        } : undefined,
      }));

      setTransactions(formattedTransactions);

      // Calculate stats for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: monthlyData, error: monthlyError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (monthlyError) throw monthlyError;

      const totalIncome = (monthlyData || [])
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpense = (monthlyData || [])
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setStats({
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        transactionCount: monthlyData?.length || 0,
      });

      // Generate chart data for last 6 months
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short' }),
          start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0],
        });
      }

      const { data: allTransactions, error: allError } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('date', months[0].start)
        .lte('date', months[5].end);

      if (allError) throw allError;

      const chartDataFormatted = months.map(m => {
        const monthTransactions = (allTransactions || []).filter(t => {
          const tDate = t.date;
          return tDate >= m.start && tDate <= m.end;
        });

        return {
          month: m.month,
          income: monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0),
          expense: monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0),
        };
      });

      setChartData(chartDataFormatted);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {user?.user_metadata?.full_name || 'Usuário'}! | {company?.name}
          </p>
        </div>
        {canEdit && (
          <Link to="/transactions">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Transação
            </Button>
          </Link>
        )}
      </div>

      {/* Negative Balance Alert */}
      {stats.balance < 0 && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Saldo Negativo</p>
            <p className="text-sm text-destructive/80">
              Seu saldo do mês está negativo em {formatCurrency(Math.abs(stats.balance))}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receitas do Mês"
          value={formatCurrency(stats.totalIncome)}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="Despesas do Mês"
          value={formatCurrency(stats.totalExpense)}
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          title="Saldo do Mês"
          value={formatCurrency(stats.balance)}
          icon={Wallet}
          variant={stats.balance >= 0 ? 'income' : 'expense'}
        />
        <StatCard
          title="Transações"
          value={stats.transactionCount.toString()}
          subtitle="Este mês"
          icon={Target}
        />
      </div>

      {/* Charts and Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyChart data={chartData} />
        <RecentTransactions transactions={transactions} />
      </div>
    </div>
  );
}
