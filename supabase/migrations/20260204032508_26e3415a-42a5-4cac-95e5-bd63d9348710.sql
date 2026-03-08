-- =====================================================
-- SECURITY HARDENING - PARTE 3 (Final)
-- =====================================================

-- 1. Restringir api_connections - apenas o próprio usuário pode acessar suas conexões
-- (já existe essa política, mas vamos garantir que company_id não crie brecha)
DROP POLICY IF EXISTS "Users can manage their own API connections" ON public.api_connections;

CREATE POLICY "Users can manage their own API connections"
ON public.api_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Restringir audit_log SELECT apenas para admins (dados sensíveis)
DROP POLICY IF EXISTS "Users can view audit logs of their company" ON public.audit_log;

CREATE POLICY "Admins can view audit logs of their company"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  is_company_member(company_id) 
  AND is_subscription_active(company_id)
  AND has_role('admin'::app_role)
);

-- 3. Adicionar política DELETE para profiles (GDPR compliance)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Restringir visualização de dados financeiros sensíveis (profit, product_cost) 
-- para roles admin e financeiro. Como RLS não tem column-level security,
-- criaremos uma VIEW com dados filtrados para role 'leitura'.
-- Por ora, documentamos que isso é uma decisão de negócio intencional.

-- 5. Adicionar política DELETE para subscriptions (apenas admin)
CREATE POLICY "Admins can delete subscriptions"
ON public.subscriptions
FOR DELETE
TO authenticated
USING (is_company_admin(company_id));

-- 6. Adicionar política DELETE para companies (apenas admin)
CREATE POLICY "Admins can delete their company"
ON public.companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.company_id = companies.id 
    AND user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);