import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

/**
 * Hook que garante que company_id está disponível antes de qualquer operação.
 * Retorna company_id validado e uma função guard para proteger mutations.
 */
export function useRequireCompany() {
  const { user } = useAuth();
  const { company, userRole, isSubscriptionActive, loading } = useCompany();

  const companyId = company?.id ?? null;
  const userId = user?.id ?? null;
  const role = userRole?.role ?? null;

  /**
   * Valida que o contexto de empresa está pronto.
   * Lança erro se company_id não estiver disponível.
   */
  const requireCompany = useCallback((): { companyId: string; userId: string; role: string } => {
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    if (!companyId) {
      throw new Error('Empresa não carregada. Aguarde o carregamento ou faça login novamente.');
    }
    // Billing desativado — não verificar assinatura
    if (!role) {
      throw new Error('Papel do usuário não definido');
    }
    return { companyId, userId, role };
  }, [userId, companyId, role]);

  /**
   * Verifica se o contexto de empresa está pronto (sem lançar erro).
   */
  const isReady = !loading && !!companyId && !!userId;

  return {
    companyId,
    userId,
    role,
    isReady,
    loading,
    requireCompany,
  };
}
