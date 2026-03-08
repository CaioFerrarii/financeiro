-- Corrigir política permissiva de INSERT em companies
-- Primeiro remover a política antiga
DROP POLICY IF EXISTS "Anyone can create a company" ON public.companies;

-- Criar política mais restritiva - apenas usuários autenticados podem criar empresas
CREATE POLICY "Authenticated users can create a company"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);