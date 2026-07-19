import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { AuthGate, type AuthGateDeps, type SignUpResult, type SignInResult } from './AuthGate';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  recoveryMode: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthGate(supabaseClient: typeof supabase) {
  return new AuthGate(supabaseClient as unknown as AuthGateDeps);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const authGate = createAuthGate(supabase);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const currentSession = await authGate.getSession();
        if (!mounted) return;
        if (currentSession) {
          setSession(currentSession);
          const currentUser = await authGate.getUser();
          if (!mounted) return;
          setUser(currentUser);
        }
      } catch (err) {
        console.warn('Auth initialization failed:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set a maximum initialization time so the app renders even if Supabase is slow
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 500);

    initAuth();

    const { unsubscribe } = authGate.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        setRecoveryMode(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    recoveryMode,
    signUp: authGate.signUp.bind(authGate),
    signIn: authGate.signIn.bind(authGate),
    signOut: authGate.signOut.bind(authGate),
    resetPassword: (email: string) =>
      authGate.resetPassword(email, `${window.location.origin}/study/reset-password`),
    updatePassword: authGate.updatePassword.bind(authGate),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}