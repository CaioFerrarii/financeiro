-- Criar enums para roles e status de assinatura
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'leitura');
CREATE TYPE public.subscription_status AS ENUM ('ativo', 'suspenso', 'cancelado');

-- Tabela de empresas
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles de usuários (separada conforme boas práticas)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'leitura',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plano TEXT NOT NULL DEFAULT 'unico',
  valor DECIMAL(10,2) NOT NULL DEFAULT 99.90,
  data_ativacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_renovacao TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  status subscription_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de auditoria
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar company_id às tabelas existentes
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.alerts ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.api_connections ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.export_history ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.import_history ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.user_settings ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Função para obter company_id do usuário atual (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Função para verificar role (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Função para verificar se usuário pertence à empresa
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND company_id = _company_id
  )
$$;

-- Função para verificar se é admin da empresa
CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND company_id = _company_id AND role = 'admin'
  )
$$;

-- Função para verificar se assinatura está ativa
CREATE OR REPLACE FUNCTION public.is_subscription_active(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE company_id = _company_id AND status = 'ativo'
  )
$$;

-- Políticas RLS para companies
CREATE POLICY "Users can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (public.is_company_member(id));

CREATE POLICY "Admins can update their company"
ON public.companies FOR UPDATE
TO authenticated
USING (public.is_company_admin(id));

CREATE POLICY "Anyone can create a company"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Políticas RLS para user_roles
CREATE POLICY "Users can view roles in their company"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_company_admin(company_id));

CREATE POLICY "Users can insert their own initial role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Políticas RLS para subscriptions
CREATE POLICY "Users can view their company subscription"
ON public.subscriptions FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

CREATE POLICY "Admins can manage subscription"
ON public.subscriptions FOR ALL
TO authenticated
USING (public.is_company_admin(company_id));

-- Políticas RLS para audit_log
CREATE POLICY "Users can view audit logs of their company"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.is_company_member(company_id) AND public.is_subscription_active(company_id));

CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));

-- Atualizar políticas das tabelas existentes para usar company_id
-- Transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;

CREATE POLICY "Company members can view transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_subscription_active(company_id));

CREATE POLICY "Company members can create transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.is_subscription_active(company_id) AND (public.has_role('admin') OR public.has_role('financeiro')));

CREATE POLICY "Company members can update transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_subscription_active(company_id) AND (public.has_role('admin') OR public.has_role('financeiro')));

CREATE POLICY "Company admins can delete transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_subscription_active(company_id) AND public.has_role('admin'));

-- Categories
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;

CREATE POLICY "Company members can view categories"
ON public.categories FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Company members can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND (public.has_role('admin') OR public.has_role('financeiro')));

-- Alerts
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can create their own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can update their own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users can delete their own alerts" ON public.alerts;

CREATE POLICY "Company members can view alerts"
ON public.alerts FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "System can manage alerts"
ON public.alerts FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX idx_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_audit_log_company_id ON public.audit_log(company_id);
CREATE INDEX idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX idx_categories_company_id ON public.categories(company_id);
CREATE INDEX idx_alerts_company_id ON public.alerts(company_id);