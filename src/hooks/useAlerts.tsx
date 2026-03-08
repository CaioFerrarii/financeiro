import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useRequireCompany } from '@/hooks/useRequireCompany';

export type AlertType = 
  | 'transaction_created'
  | 'transaction_edited'
  | 'transaction_deleted'
  | 'import_completed'
  | 'export_completed'
  | 'api_sync'
  | 'duplicate_detected'
  | 'login'
  | 'logout'
  | 'system';

interface AlertMetadata {
  transaction_id?: string;
  old_data?: any;
  new_data?: any;
  file_name?: string;
  rows_count?: number;
  format?: string;
  platform?: string;
  original_transaction_id?: string;
  duplicate_transaction_id?: string;
  [key: string]: any;
}

export function useAlerts() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { companyId, userId } = useRequireCompany();

  const createAlert = useCallback(async (
    type: AlertType,
    message: string,
    metadata: AlertMetadata = {}
  ) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .insert({
          user_id: userId,
          company_id: companyId || null,
          type,
          message,
          metadata,
        });

      if (error) {
        console.error('Error creating alert:', error);
      }
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }, [userId, companyId]);

  const checkDuplicates = useCallback(async (
    categoryId: string | null,
    amount: number,
    date: string,
    currentTransactionId?: string
  ): Promise<{ isDuplicate: boolean; duplicateId?: string }> => {
    if (!userId || !companyId) return { isDuplicate: false };

    try {
      // Check for transactions with same category, amount, and within the same week
      const transactionDate = new Date(date);
      const weekStart = new Date(transactionDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      let query = supabase
        .from('transactions')
        .select('id')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .eq('amount', amount)
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', weekEnd.toISOString().split('T')[0]);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (currentTransactionId) {
        query = query.neq('id', currentTransactionId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('Error checking duplicates:', error);
        return { isDuplicate: false };
      }

      if (data && data.length > 0) {
        return { isDuplicate: true, duplicateId: data[0].id };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return { isDuplicate: false };
    }
  }, [userId, companyId]);

  return {
    createAlert,
    checkDuplicates,
  };
}
