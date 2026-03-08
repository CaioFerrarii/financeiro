-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can create a company" ON public.companies;

-- Create permissive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create a company"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);
