-- Fix overly permissive INSERT policy on subscriptions
-- Replace WITH CHECK (true) with a more restrictive check

DROP POLICY IF EXISTS "Users can create subscription for their company" ON public.subscriptions;

-- Users can only create subscription when they are creating a company (must be the admin of that company)
-- This is called right after creating a company, so we check if the user has an admin role for that company
CREATE POLICY "Users can create subscription for their company"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.company_id = subscriptions.company_id
      AND user_roles.role = 'admin'
  )
);