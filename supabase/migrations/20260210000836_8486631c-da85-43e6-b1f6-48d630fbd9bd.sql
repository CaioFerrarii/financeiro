
-- Function to validate user belongs to company before any operation
-- Returns true if valid, raises exception if not
CREATE OR REPLACE FUNCTION public.validate_user_company_access(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this company';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE company_id = p_company_id AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Company subscription is not active';
  END IF;
  
  RETURN true;
END;
$$;

-- Function to log auth events (login/logout) server-side
CREATE OR REPLACE FUNCTION public.log_auth_event(p_action text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_audit_id UUID;
BEGIN
  SELECT get_user_company_id() INTO v_company_id;
  
  -- Allow logging even without company (e.g., first login)
  IF v_company_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO public.audit_log (company_id, user_id, table_name, action, record_id, new_data)
  VALUES (v_company_id, auth.uid(), 'auth', p_action, auth.uid(), p_metadata)
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;
