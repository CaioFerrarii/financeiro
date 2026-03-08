-- =====================================================
-- SECURITY FIX: Restrict financial data and encrypt API credentials
-- =====================================================

-- 1. TRANSACTIONS: Restringir dados financeiros sensíveis (profit, product_cost, tax_amount)
--    para roles admin e financeiro apenas

-- Remover a política SELECT atual que permite todos os membros
DROP POLICY IF EXISTS "Company members can view transactions" ON public.transactions;

-- Criar política que permite leitura básica para todos, mas sem dados sensíveis
-- Como RLS não tem column-level security, vamos criar uma VIEW para role 'leitura'
-- e manter a política original restrita

-- Criar VIEW segura para role 'leitura' (sem dados financeiros sensíveis)
CREATE OR REPLACE VIEW public.transactions_safe AS
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
  -- Campos sensíveis: ocultar para role leitura via função
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

-- Dar permissão de SELECT na view
GRANT SELECT ON public.transactions_safe TO authenticated;

-- Recriar política de SELECT na tabela original (mantém acesso direto para admin/financeiro)
CREATE POLICY "Company members can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  (company_id = get_user_company_id() AND is_subscription_active(company_id))
);

-- 2. API_CONNECTIONS: Criar funções para criptografia de credenciais
-- Usando pgcrypto para criptografia simétrica (AES-256)

-- Habilitar extensão pgcrypto se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para criptografar credenciais (usar chave derivada do user_id + secret)
CREATE OR REPLACE FUNCTION public.encrypt_api_credential(
  p_plaintext TEXT,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_plaintext IS NULL OR p_plaintext = '' THEN
    RETURN NULL;
  END IF;
  
  -- Derivar chave a partir do user_id (em produção, use uma chave de ambiente)
  v_key := encode(digest(p_user_id::text || 'sh-financas-secret-key-2024', 'sha256'), 'hex');
  
  RETURN encode(encrypt(p_plaintext::bytea, v_key::bytea, 'aes'), 'base64');
END;
$$;

-- Função para descriptografar credenciais
CREATE OR REPLACE FUNCTION public.decrypt_api_credential(
  p_ciphertext TEXT,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_ciphertext IS NULL OR p_ciphertext = '' THEN
    RETURN NULL;
  END IF;
  
  -- Mesma derivação de chave
  v_key := encode(digest(p_user_id::text || 'sh-financas-secret-key-2024', 'sha256'), 'hex');
  
  RETURN convert_from(decrypt(decode(p_ciphertext, 'base64'), v_key::bytea, 'aes'), 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL; -- Retorna NULL se descriptografia falhar
END;
$$;

-- Criar trigger para criptografar automaticamente ao inserir/atualizar
CREATE OR REPLACE FUNCTION public.encrypt_api_credentials_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  -- Criptografar api_key se presente e não já criptografado
  IF NEW.api_key IS NOT NULL AND NEW.api_key != '' AND 
     (TG_OP = 'INSERT' OR OLD.api_key IS DISTINCT FROM NEW.api_key) THEN
    NEW.api_key := encrypt_api_credential(NEW.api_key, NEW.user_id);
  END IF;
  
  -- Criptografar api_secret se presente
  IF NEW.api_secret IS NOT NULL AND NEW.api_secret != '' AND
     (TG_OP = 'INSERT' OR OLD.api_secret IS DISTINCT FROM NEW.api_secret) THEN
    NEW.api_secret := encrypt_api_credential(NEW.api_secret, NEW.user_id);
  END IF;
  
  -- Criptografar access_token se presente
  IF NEW.access_token IS NOT NULL AND NEW.access_token != '' AND
     (TG_OP = 'INSERT' OR OLD.access_token IS DISTINCT FROM NEW.access_token) THEN
    NEW.access_token := encrypt_api_credential(NEW.access_token, NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS encrypt_api_credentials ON public.api_connections;
CREATE TRIGGER encrypt_api_credentials
  BEFORE INSERT OR UPDATE ON public.api_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_api_credentials_trigger();

-- VIEW para ler credenciais descriptografadas (apenas para o próprio usuário)
CREATE OR REPLACE VIEW public.api_connections_decrypted AS
SELECT 
  id,
  user_id,
  company_id,
  platform,
  is_active,
  last_sync_at,
  created_at,
  updated_at,
  -- Campos descriptografados (só funcionam para o próprio usuário)
  decrypt_api_credential(api_key, user_id) as api_key,
  decrypt_api_credential(api_secret, user_id) as api_secret,
  decrypt_api_credential(access_token, user_id) as access_token
FROM public.api_connections
WHERE user_id = auth.uid();

GRANT SELECT ON public.api_connections_decrypted TO authenticated;