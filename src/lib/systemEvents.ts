import { supabase } from '@/integrations/supabase/client';

export type SystemEventType =
  | 'login'
  | 'logout'
  | 'company_switch'
  | 'permission_denied'
  | 'inconsistency_detected'
  | 'validation_error'
  | 'session_cleared';

interface SystemEventPayload {
  event_type: SystemEventType;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Logs a security/system event to the system_events table.
 * Best-effort: never throws.
 */
export async function logSystemEvent(payload: SystemEventPayload): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let companyId: string | null = null;

    try {
      const { data } = await supabase.rpc('get_user_company_id');
      companyId = data as string | null;
    } catch {
      // May fail if user has no company yet
    }

    await supabase.from('system_events' as any).insert({
      user_id: user?.id ?? null,
      company_id: companyId,
      event_type: payload.event_type,
      description: payload.description,
      metadata: payload.metadata ?? {},
    });
  } catch {
    // Silent — event logging must never break the app
    console.warn('[SystemEvent] Failed to log:', payload.event_type);
  }
}
