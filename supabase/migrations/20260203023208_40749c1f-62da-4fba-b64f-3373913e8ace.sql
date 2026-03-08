-- Fix: overly-permissive RLS policy on companies INSERT (WITH CHECK (true))
-- Allow company creation only for authenticated users that do NOT yet have a company role

DROP POLICY IF EXISTS "Authenticated users can create a company" ON public.companies;
DROP POLICY IF EXISTS "Allow bootstrap insert company" ON public.companies;

CREATE POLICY "Authenticated users can create a company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
);
