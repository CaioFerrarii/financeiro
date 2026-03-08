-- Unified bootstrap for a user that has no company/role yet
-- Creates: company + admin role + active (free) subscription + updates/creates profile.company_id

CREATE OR REPLACE FUNCTION public.bootstrap_user_company(
  company_name TEXT,
  company_document TEXT,
  company_email TEXT DEFAULT NULL,
  company_phone TEXT DEFAULT NULL,
  company_address TEXT DEFAULT NULL,
  profile_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- If the user already has a role/company, return it (idempotent)
  SELECT company_id
  INTO v_company_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- Create company
  INSERT INTO public.companies (name, document, email, phone, address)
  VALUES (company_name, company_document, company_email, company_phone, company_address)
  RETURNING id INTO v_company_id;

  -- Create admin role
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (auth.uid(), v_company_id, 'admin');

  -- Create active subscription (free)
  INSERT INTO public.subscriptions (company_id, status, plano, valor)
  VALUES (v_company_id, 'ativo', 'Plano SH Completo', 0);

  -- Ensure profile exists and set company_id
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) THEN
    UPDATE public.profiles
    SET company_id = v_company_id,
        full_name = COALESCE(full_name, profile_full_name),
        updated_at = now()
    WHERE user_id = auth.uid();
  ELSE
    INSERT INTO public.profiles (user_id, company_id, full_name)
    VALUES (auth.uid(), v_company_id, profile_full_name);
  END IF;

  RETURN v_company_id;
END;
$$;

-- Lock down function execution to logged-in users
REVOKE ALL ON FUNCTION public.bootstrap_user_company(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_user_company(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
