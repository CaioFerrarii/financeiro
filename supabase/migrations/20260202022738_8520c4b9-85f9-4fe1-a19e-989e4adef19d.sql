-- Fix companies RLS policies - make them truly PERMISSIVE
-- The issue is that we need to allow INSERT without checking is_company_member (circular dependency)

-- First, drop ALL existing policies on companies
DROP POLICY IF EXISTS "Authenticated users can create a company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;

-- Recreate policies as PERMISSIVE (default)
-- Any authenticated user can create a company
CREATE POLICY "Anyone can create a company"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can view their own company (via user_roles membership)
CREATE POLICY "Users can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.company_id = companies.id
      AND user_roles.user_id = auth.uid()
  )
);

-- Only admins can update their company
CREATE POLICY "Admins can update their company"
ON public.companies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.company_id = companies.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
  )
);

-- Fix user_roles INSERT policy - allow users to create their own first role
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;
CREATE POLICY "Users can insert their own initial role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix subscriptions INSERT policy - allow creating subscription for companies user just created
DROP POLICY IF EXISTS "Users can create subscription for their company" ON public.subscriptions;
CREATE POLICY "Users can create subscription for their company"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.company_id = subscriptions.company_id
      AND user_roles.user_id = auth.uid()
  )
);