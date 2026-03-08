import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { logSystemEvent } from '@/lib/systemEvents';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthorizedEmail: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Limpa completamente o estado da sessão
  const clearSessionState = useCallback(() => {
    // Limpar todo o cache do React Query
    queryClient.clear();
    // Limpar localStorage de dados temporários (preservar tokens de auth)
    localStorage.removeItem('pending_company_bootstrap_v1');
    // Reset state
    setUser(null);
    setSession(null);
  }, [queryClient]);

  useEffect(() => {
    let previousUserId: string | null = null;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;

        // Detectar troca de usuário — limpar tudo
        if (previousUserId && newUserId && previousUserId !== newUserId) {
          clearSessionState();
          logSystemEvent({
            event_type: 'company_switch',
            description: 'Troca de usuário detectada — sessão limpa',
            metadata: { previous_user: previousUserId, new_user: newUserId },
          });
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        previousUserId = newUserId;

        // Registrar eventos de auth no audit_log (server-side via RPC)
        if (event === 'SIGNED_IN' && newSession?.user) {
          // Defer para não bloquear o auth state change
          setTimeout(async () => {
            try {
              await supabase.rpc('log_auth_event' as any, {
                p_action: 'login',
                p_metadata: { email: newSession.user.email, timestamp: new Date().toISOString() },
              });
            } catch {
              /* silent - audit is best-effort */
            }
          }, 0);
        }

        if (event === 'SIGNED_OUT') {
          logSystemEvent({
            event_type: 'logout',
            description: 'Usuário deslogou — sessão limpa',
          });
          clearSessionState();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      previousUserId = existingSession?.user?.id ?? null;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [clearSessionState]);

  const isAuthorizedEmail = async (email: string): Promise<boolean> => {
    void email;
    return true;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Registrar logout antes de limpar sessão
    try {
      await supabase.rpc('log_auth_event' as any, {
        p_action: 'logout',
        p_metadata: { timestamp: new Date().toISOString() },
      });
    } catch {
      /* silent - audit is best-effort */
    }

    await supabase.auth.signOut();
    clearSessionState();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      isAuthorizedEmail 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
