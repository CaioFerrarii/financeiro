import { useState, useEffect, useCallback } from 'react';
import { Table2, Plus, Trash2, Save, Filter, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';
import { useAlerts } from '@/hooks/useAlerts';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  category_id: string | null;
  subcategory: string | null;
  amount: number;
  type: 'income' | 'expense';
  tax_amount: number | null;
  product_cost: number | null;
  profit: number | null;
  origin: string | null;
  categories?: Category;
}

interface EditingCell {
  id: string;
  field: keyof Transaction;
  value: any;
}

export default function Spreadsheet() {
  const { user } = useAuth();
  const { company, canEdit } = useCompany();
  const { companyId, isReady, requireCompany } = useRequireCompany();
  const { toast } = useToast();
  const { createAlert } = useAlerts();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !companyId) return;
    
    fetchData();
    setupRealtimeSubscription();
  }, [isReady, companyId]);

  const setupRealtimeSubscription = () => {
    if (!companyId) return;
    
    const channel = supabase
      .channel('spreadsheet-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchData = async () => {
    if (!companyId) return;
    
    try {
      const [transactionsRes, categoriesRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            categories (
              id,
              name,
              color
            )
          `)
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('date', { ascending: false }),
        supabase
          .from('categories')
          .select('*')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('name'),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const formattedTransactions = (transactionsRes.data || []).map((t: any) => ({
        ...t,
        type: t.type as 'income' | 'expense',
      }));
      
      setTransactions(formattedTransactions);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCellDoubleClick = (id: string, field: keyof Transaction, value: any) => {
    if (!canEdit) return;
    setEditingCell({ id, field, value });
  };

  const handleCellChange = (value: any) => {
    if (editingCell) {
      setEditingCell({ ...editingCell, value });
    }
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    setSaving(true);
    try {
      const transaction = transactions.find(t => t.id === editingCell.id);
      if (!transaction) return;

      const oldValue = transaction[editingCell.field];
      let newValue = editingCell.value;

      if (['amount', 'tax_amount', 'product_cost', 'profit'].includes(editingCell.field)) {
        newValue = parseFloat(newValue) || 0;
      }

      const { error } = await supabase
        .from('transactions')
        .update({ [editingCell.field]: newValue })
        .eq('id', editingCell.id);

      if (error) throw error;

      await createAlert('transaction_edited', `Transação editada: ${transaction.description}`, {
        transactionId: editingCell.id,
        field: editingCell.field,
        oldValue,
        newValue,
      });

      toast({
        title: 'Salvo',
        description: 'Alteração salva automaticamente.',
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleAddRow = async () => {
    try {
      const { companyId: cId, userId } = requireCompany();

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          company_id: cId,
          description: 'Nova transação',
          amount: 0,
          type: 'expense',
          date: new Date().toISOString().split('T')[0],
          origin: 'manual',
        })
        .select()
        .single();

      if (error) throw error;

      await createAlert('transaction_created', 'Nova transação criada via planilha', {
        transactionId: data.id,
      });

      toast({
        title: 'Linha adicionada',
        description: 'Nova transação criada. Clique duas vezes para editar.',
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error adding row:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a linha.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRow = async () => {
    if (!deleteId) return;

    try {
      const transaction = transactions.find(t => t.id === deleteId);
      
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', deleteId);

      if (error) throw error;

      await createAlert('transaction_deleted', `Transação excluída: ${transaction?.description}`, {
        transactionId: deleteId,
        deletedData: transaction,
      });

      toast({
        title: 'Excluído',
        description: 'Transação removida com sucesso.',
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a transação.',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = filterMonth === 'all' || t.date.startsWith(filterMonth);
    const matchesCategory = filterCategory === 'all' || t.category_id === filterCategory;
    return matchesSearch && matchesMonth && matchesCategory;
  });

  const getOriginLabel = (origin: string | null) => {
    switch (origin) {
      case 'manual': return 'Manual';
      case 'import': return 'Importação';
      case 'api': return 'API';
      default: return origin || '-';
    }
  };

  const months = [...new Set(transactions.map(t => t.date.substring(0, 7)))].sort().reverse();

  const renderEditableCell = (
    transaction: Transaction,
    field: keyof Transaction,
    displayValue: React.ReactNode,
    inputType: 'text' | 'number' | 'date' = 'text'
  ) => {
    const isEditing = editingCell?.id === transaction.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <Input
          type={inputType}
          value={editingCell.value}
          onChange={(e) => handleCellChange(e.target.value)}
          onBlur={handleCellBlur}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          autoFocus
        />
      );
    }

    return (
      <div
        className={cn(
          "px-2 py-1 rounded min-h-[32px] flex items-center",
          canEdit && "cursor-pointer hover:bg-muted/50"
        )}
        onDoubleClick={() => handleCellDoubleClick(transaction.id, field, transaction[field])}
      >
        {displayValue}
      </div>
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Planilha
          </h1>
          <p className="text-muted-foreground">
            Visualize e edite transações em formato de planilha
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={handleAddRow} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Linha
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {format(new Date(m + '-01'), 'MMMM yyyy', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Salvando...
        </div>
      )}

      {/* Spreadsheet */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Subcategoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Imposto</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead>Origem</TableHead>
                {canEdit && <TableHead className="w-[60px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/30">
                    <TableCell>
                      {renderEditableCell(
                        transaction,
                        'date',
                        format(new Date(transaction.date), 'dd/MM/yy'),
                        'date'
                      )}
                    </TableCell>
                    <TableCell>
                      {renderEditableCell(
                        transaction,
                        'description',
                        transaction.description
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.categories ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: transaction.categories.color }}
                          />
                          <span className="text-sm">{transaction.categories.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {renderEditableCell(
                        transaction,
                        'subcategory',
                        transaction.subcategory || '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        'font-medium',
                        transaction.type === 'income' ? 'text-primary' : 'text-destructive'
                      )}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEditableCell(
                        transaction,
                        'tax_amount',
                        formatCurrency(transaction.tax_amount),
                        'number'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEditableCell(
                        transaction,
                        'product_cost',
                        formatCurrency(transaction.product_cost),
                        'number'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEditableCell(
                        transaction,
                        'profit',
                        formatCurrency(transaction.profit),
                        'number'
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getOriginLabel(transaction.origin)}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRow} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
