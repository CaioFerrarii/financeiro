
-- 1. Create system_logs table for centralized error logging
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  type TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  endpoint TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Only company admins can view logs
CREATE POLICY "Admins can view system logs"
ON public.system_logs
FOR SELECT
USING (is_company_admin(company_id));

-- Allow inserts from authenticated users for their company
CREATE POLICY "Authenticated users can insert system logs"
ON public.system_logs
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Index for fast querying
CREATE INDEX idx_system_logs_company_created ON public.system_logs(company_id, created_at DESC);
CREATE INDEX idx_system_logs_type ON public.system_logs(type);

-- Enable realtime for system_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;

-- 2. Create function to detect duplicate transactions
CREATE OR REPLACE FUNCTION public.check_duplicate_transactions(p_company_id UUID)
RETURNS TABLE(
  transaction_id UUID,
  duplicate_of UUID,
  amount NUMERIC,
  date DATE,
  description TEXT,
  similarity_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t1.id AS transaction_id,
    t2.id AS duplicate_of,
    t1.amount,
    t1.date,
    t1.description,
    CASE 
      WHEN t1.description = t2.description THEN 1.0
      WHEN LOWER(t1.description) = LOWER(t2.description) THEN 0.95
      ELSE 0.8
    END::NUMERIC AS similarity_score
  FROM public.transactions t1
  JOIN public.transactions t2 ON t1.id < t2.id
    AND t1.company_id = t2.company_id
    AND t1.amount = t2.amount
    AND t1.date = t2.date
    AND (
      t1.description = t2.description
      OR LOWER(t1.description) = LOWER(t2.description)
      OR similarity(LOWER(t1.description), LOWER(t2.description)) > 0.6
    )
  WHERE t1.company_id = p_company_id
  ORDER BY t1.date DESC
  LIMIT 50;
END;
$$;

-- 3. Create backup_history table to track backups
CREATE TABLE public.backup_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  backup_type TEXT NOT NULL DEFAULT 'daily',
  tables_backed_up TEXT[] NOT NULL DEFAULT '{}',
  row_counts JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup history"
ON public.backup_history
FOR SELECT
USING (is_company_admin(company_id));

CREATE POLICY "System can insert backup history"
ON public.backup_history
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE INDEX idx_backup_history_company ON public.backup_history(company_id, started_at DESC);
