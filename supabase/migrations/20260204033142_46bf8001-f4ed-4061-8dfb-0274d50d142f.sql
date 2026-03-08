-- =====================================================
-- FIX: Converter views de SECURITY DEFINER para SECURITY INVOKER
-- =====================================================

-- Recriar transactions_safe com SECURITY INVOKER (padrão)
DROP VIEW IF EXISTS public.transactions_safe;
CREATE VIEW public.transactions_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  company_id,
  description,
  amount,
  type,
  date,
  category_id,
  subcategory,
  source,
  origin,
  notes,
  created_at,
  updated_at,
  CASE 
    WHEN has_role('admin'::app_role) OR has_role('financeiro'::app_role) THEN profit
    ELSE NULL
  END as profit,
  CASE 
    WHEN has_role('admin'::app_role) OR has_role('financeiro'::app_role) THEN product_cost
    ELSE NULL
  END as product_cost,
  CASE 
    WHEN has_role('admin'::app_role) OR has_role('financeiro'::app_role) THEN tax_amount
    ELSE NULL
  END as tax_amount
FROM public.transactions;

GRANT SELECT ON public.transactions_safe TO authenticated;

-- Recriar api_connections_decrypted com SECURITY INVOKER
DROP VIEW IF EXISTS public.api_connections_decrypted;
CREATE VIEW public.api_connections_decrypted 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  company_id,
  platform,
  is_active,
  last_sync_at,
  created_at,
  updated_at,
  decrypt_api_credential(api_key, user_id) as api_key,
  decrypt_api_credential(api_secret, user_id) as api_secret,
  decrypt_api_credential(access_token, user_id) as access_token
FROM public.api_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.api_connections_decrypted TO authenticated;