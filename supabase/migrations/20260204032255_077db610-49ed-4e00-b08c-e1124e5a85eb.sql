-- =====================================================
-- SECURITY HARDENING - PARTE 2
-- =====================================================

-- 1. BLOQUEAR UPDATE/DELETE em audit_log completamente
-- (já não existem políticas INSERT abertas, mas garantir que write está fechado)
DROP POLICY IF EXISTS "Users can update audit logs of their company" ON public.audit_log;
DROP POLICY IF EXISTS "Users can delete audit logs of their company" ON public.audit_log;

-- Não é necessário criar novas políticas de UPDATE/DELETE - ausência de policy = bloqueado

-- 2. Criar índices para performance de queries RLS
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_company_id ON public.alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON public.subscriptions(company_id);

-- 3. Adicionar constraint para garantir que profiles.user_id é único
-- (previne duplicação de perfis)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;