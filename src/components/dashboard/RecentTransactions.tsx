import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (transactions.length === 0) {
    return (
      <div className="card-finance">
        <h3 className="text-lg font-display font-semibold mb-4">Transações Recentes</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhuma transação encontrada.</p>
          <p className="text-sm mt-1">Adicione sua primeira transação!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-finance">
      <h3 className="text-lg font-display font-semibold mb-4">Transações Recentes</h3>
      <div className="space-y-3">
        {transactions.map((transaction, index) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              {transaction.category && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: transaction.category.color }}
                />
              )}
              <div>
                <p className="font-medium text-foreground">{transaction.description}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(transaction.date), "d 'de' MMM", { locale: ptBR })}
                  {transaction.category && ` • ${transaction.category.name}`}
                </p>
              </div>
            </div>
            <span className={cn(
              "font-semibold",
              transaction.type === 'income' ? "text-primary" : "text-destructive"
            )}>
              {transaction.type === 'income' ? '+' : '-'}
              {formatCurrency(transaction.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
