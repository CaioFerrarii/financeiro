import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';

type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'import' 
  | 'export' 
  | 'login' 
  | 'logout'
  | 'sync';

interface AuditLogParams {
  action: AuditAction;
  tableName: string;
  recordId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

export function useAudit() {
  const { user } = useAuth();
  const { company } = useCompany();

  const logAction = async ({
    action,
    tableName,
    recordId,
    oldData,
    newData,
  }: AuditLogParams): Promise<void> => {
    if (!user || !company) return;

    try {
      const { error } = await supabase
        .from('audit_log')
        .insert({
          company_id: company.id,
          user_id: user.id,
          action,
          table_name: tableName,
          record_id: recordId || null,
          old_data: oldData || null,
          new_data: newData || null,
        });

      if (error) {
        console.error('Error logging audit action:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };

  return { logAction };
}
