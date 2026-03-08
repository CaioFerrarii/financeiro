import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const PENDING_COMPANY_BOOTSTRAP_KEY = 'pending_company_bootstrap_v1';

interface Company {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  company_id: string;
  role: 'admin' | 'financeiro' | 'leitura';
  created_at: string;
}

interface Subscription {
  id: string;
  company_id: string;
  plano: string;
  valor: number;
  data_ativacao: string;
  data_renovacao: string;
  status: 'ativo' | 'suspenso' | 'cancelado';
}

interface CompanyContextType {
  company: Company | null;
  userRole: UserRole | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isFinanceiro: boolean;
  canEdit: boolean;
  isSubscriptionActive: boolean;
  createCompany: (data: CreateCompanyData) => Promise<{ error: Error | null; company: Company | null }>;
  refreshCompany: () => Promise<void>;
}

interface CreateCompanyData {
  name: string;
  document: string;
  email?: string;
  phone?: string;
  address?: string;
}

type PendingCompanyBootstrap = {
  fullName?: string;
  companyName: string;
  document: string;
  companyEmail?: string;
  companyPhone?: string;
  address?: string;
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole?.role === 'admin';
  const isFinanceiro = userRole?.role === 'financeiro';
  const canEdit = isAdmin || isFinanceiro;
  // Billing desativado — sempre ativo em produção sem billing
  const isSubscriptionActive = true;

  // Limpa todo o estado de empresa e invalida queries
  const resetCompanyState = useCallback(() => {
    setCompany(null);
    setUserRole(null);
    setSubscription(null);
    setError(null);
    // Invalidar todas as queries que dependem de company_id
    queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (user) {
      fetchCompanyData();
    } else {
      // Usuário deslogou — reset completo
      resetCompanyState();
      setLoading(false);
    }
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      const readPendingBootstrap = (): PendingCompanyBootstrap | null => {
        try {
          const raw = localStorage.getItem(PENDING_COMPANY_BOOTSTRAP_KEY);
          if (!raw) return null;
          return JSON.parse(raw) as PendingCompanyBootstrap;
        } catch {
          return null;
        }
      };

      const tryBootstrapFromPending = async (): Promise<boolean> => {
        const pending = readPendingBootstrap();
        if (!pending) return false;

        const { error: rpcError } = await supabase.rpc('bootstrap_user_company', {
          company_name: pending.companyName,
          company_document: pending.document,
          company_email: pending.companyEmail ?? null,
          company_phone: pending.companyPhone ?? null,
          company_address: pending.address ?? null,
          profile_full_name: pending.fullName ?? null,
        });

        if (rpcError) {
          throw rpcError;
        }

        localStorage.removeItem(PENDING_COMPANY_BOOTSTRAP_KEY);
        return true;
      };

      // Fetch user's role and company
      let { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (!roleData) {
        try {
          const didBootstrap = await tryBootstrapFromPending();
          if (didBootstrap) {
            const res = await supabase
              .from('user_roles')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();

            roleData = res.data;
            roleError = res.error;
            if (roleError) throw roleError;
          }
        } catch {
          // Se bootstrap falha, permanece no estado sem empresa
        }

        if (!roleData) {
          setCompany(null);
          setUserRole(null);
          setSubscription(null);
          setLoading(false);
          return;
        }
      }

      setUserRole(roleData as UserRole);

      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', roleData.company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData as Company);

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', roleData.company_id)
        .maybeSingle();

      if (subError) throw subError;
      setSubscription(subData as Subscription | null);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados da empresa';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (data: CreateCompanyData): Promise<{ error: Error | null; company: Company | null }> => {
    if (!user) {
      return { error: new Error('Usuário não autenticado'), company: null };
    }

    try {
      const { data: companyId, error: rpcError } = await supabase.rpc('bootstrap_user_company', {
        company_name: data.name,
        company_document: data.document,
        company_email: data.email ?? null,
        company_phone: data.phone ?? null,
        company_address: data.address ?? null,
        profile_full_name: null,
      });

      if (rpcError) throw rpcError;

      await fetchCompanyData();

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId as string)
        .single();

      if (companyError) throw companyError;

      return { error: null, company: companyData as Company };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Erro ao criar empresa');
      return { error, company: null };
    }
  };

  const refreshCompany = async () => {
    await fetchCompanyData();
  };

  return (
    <CompanyContext.Provider value={{
      company,
      userRole,
      subscription,
      loading,
      error,
      isAdmin,
      isFinanceiro,
      canEdit,
      isSubscriptionActive,
      createCompany,
      refreshCompany,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
