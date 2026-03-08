
-- Recreate the view with security_invoker so it respects RLS on the underlying api_connections table
CREATE OR REPLACE VIEW public.api_connections_decrypted
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  company_id,
  platform,
  is_active,
  last_sync_at,
  created_at,
  updated_at,
  decrypt_api_credential(api_key, user_id) AS api_key,
  decrypt_api_credential(api_secret, user_id) AS api_secret,
  decrypt_api_credential(access_token, user_id) AS access_token
FROM public.api_connections;
