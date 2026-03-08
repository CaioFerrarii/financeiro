
-- Create system_events table for security events
CREATE TABLE public.system_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  user_id UUID,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Admins can view events for their company
CREATE POLICY "Admins can view system events"
ON public.system_events
FOR SELECT
USING (is_company_admin(company_id));

-- Authenticated users can insert events for their company
CREATE POLICY "Users can insert system events"
ON public.system_events
FOR INSERT
WITH CHECK (company_id = get_user_company_id() OR company_id IS NULL);

CREATE INDEX idx_system_events_company_created ON public.system_events(company_id, created_at DESC);
CREATE INDEX idx_system_events_type ON public.system_events(event_type);
CREATE INDEX idx_system_events_user ON public.system_events(user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_events;
