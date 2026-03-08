-- Drop existing RESTRICTIVE policies and recreate as PERMISSIVE

-- ==================== COMPANIES ====================
DROP POLICY IF EXISTS "Authenticated users can create a company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

-- Authenticated users can create a company (PERMISSIVE)
CREATE POLICY "Authenticated users can create a company"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update their company (PERMISSIVE)
CREATE POLICY "Admins can update their company"
ON public.companies FOR UPDATE TO authenticated
USING (is_company_admin(id));

-- Users can view their company (PERMISSIVE)
CREATE POLICY "Users can view their company"
ON public.companies FOR SELECT TO authenticated
USING (is_company_member(id));

-- ==================== USER_ROLES ====================
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their company" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their company" ON public.user_roles;

-- Users can insert their own initial role (PERMISSIVE)
CREATE POLICY "Users can insert their own initial role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can manage roles in their company (PERMISSIVE)
CREATE POLICY "Admins can manage roles in their company"
ON public.user_roles FOR ALL TO authenticated
USING (is_company_admin(company_id));

-- Users can view roles in their company (PERMISSIVE)
CREATE POLICY "Users can view roles in their company"
ON public.user_roles FOR SELECT TO authenticated
USING (is_company_member(company_id));

-- Users can view their own role (even before company is set up)
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ==================== SUBSCRIPTIONS ====================
DROP POLICY IF EXISTS "Admins can manage subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their company subscription" ON public.subscriptions;

-- New users creating a company can insert a subscription (PERMISSIVE)
CREATE POLICY "Users can create subscription for their company"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (true);

-- Admins can update subscription (PERMISSIVE)
CREATE POLICY "Admins can update subscription"
ON public.subscriptions FOR UPDATE TO authenticated
USING (is_company_admin(company_id));

-- Users can view their company subscription (PERMISSIVE)
CREATE POLICY "Users can view their company subscription"
ON public.subscriptions FOR SELECT TO authenticated
USING (is_company_member(company_id));

-- ==================== Update default subscription value to 0 ====================
ALTER TABLE public.subscriptions ALTER COLUMN valor SET DEFAULT 0;