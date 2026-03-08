import { supabase } from '@/integrations/supabase/client';

type LogType = 'error' | 'warning' | 'info' | 'sync' | 'backup';

interface LogEntry {
  type: LogType;
  message: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized system logger that writes to the system_logs table.
 * Usage: await logSystemEvent({ type: 'error', message: '...', endpoint: '/api/...' });
 */
export async function logSystemEvent(entry: LogEntry): Promise<void> {
  try {
    const { data: companyId } = await supabase.rpc('get_user_company_id');
    if (!companyId) return;

    await supabase.from('system_logs' as any).insert({
      company_id: companyId,
      type: entry.type,
      message: entry.message,
      endpoint: entry.endpoint ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Silent fail — logging should never break the app
    console.error('[SystemLogger] Failed to log event:', entry.message);
  }
}

/**
 * Wraps a supabase query and logs errors automatically.
 */
export async function withErrorLogging<T>(
  operation: () => Promise<{ data: T; error: any }>,
  context: { endpoint: string; action: string }
): Promise<{ data: T | null; error: any }> {
  const result = await operation();

  if (result.error) {
    await logSystemEvent({
      type: 'error',
      message: `${context.action}: ${result.error.message}`,
      endpoint: context.endpoint,
      metadata: { code: result.error.code, details: result.error.details },
    });
  }

  return result;
}
