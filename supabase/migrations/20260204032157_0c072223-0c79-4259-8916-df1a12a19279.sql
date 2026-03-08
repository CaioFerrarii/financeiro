-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. CORRIGIR user_roles: remover a política que permite usuário criar própria role
--    O bootstrap_user_company já é SECURITY DEFINER e cria a role apropriadamente.
--    Isso evita que um usuário mal-intencionado crie role admin em qualquer empresa.
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;

-- 2. CORRIGIR audit_log: apenas TRIGGERS/SISTEMA podem inserir, não usuários comuns
--    Isso evita manipulação do log de auditoria.
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Criar política mais restritiva: apenas via TRIGGERS (sem check de usuário)
-- O ideal é fazer isso via trigger com SECURITY DEFINER, não RLS INSERT direto.
-- Por ora, removemos a possibilidade de insert via client.

-- 3. CORRIGIR alerts: remover política ALL genérica que permite manipulação indevida
DROP POLICY IF EXISTS "System can manage alerts" ON public.alerts;

-- Criar políticas específicas por operação ao invés de ALL
CREATE POLICY "Company members can create alerts"
ON public.alerts
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id() AND auth.uid() = user_id);

CREATE POLICY "Company members can update own alerts"
ON public.alerts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Company members can delete own alerts"
ON public.alerts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. CORRIGIR categories: garantir consistência de data model (priorizar company_id)
--    A política atual permite user_id OU company_id, o que pode criar confusão.
--    Vamos manter o modelo híbrido mas garantir que company_id seja preenchido quando há empresa.

-- 5. CORRIGIR companies: política de INSERT muito permissiva
--    Já foi ajustada anteriormente, mas vamos garantir que só permite se user não tem role.
DROP POLICY IF EXISTS "Authenticated users can create a company" ON public.companies;

CREATE POLICY "New users can create first company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  )
);

-- 6. Criar trigger para preencher audit_log (SECURITY DEFINER garante insert)
-- Isso permite que audits sejam inseridos de forma segura sem policy de INSERT para users.

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_table_name TEXT,
  p_action TEXT,
  p_record_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_audit_id UUID;
BEGIN
  SELECT get_user_company_id() INTO v_company_id;
  
  IF v_company_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.audit_log (company_id, user_id, table_name, action, record_id, old_data, new_data)
  VALUES (v_company_id, auth.uid(), p_table_name, p_action, p_record_id, p_old_data, p_new_data)
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;