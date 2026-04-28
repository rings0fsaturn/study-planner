import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { AuthGate, type AuthGateDeps, type SignUpResult, type SignInResult } from './AuthGate';
import { supabase } from '../lib/supabase';
import { getEventStoreWipe } from '../events/EventStoreProvider';

const LAST_USER_ID_KEY = 'study_tracker_last_user_id';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthGate(supabaseClient: typeof supabase) {
  return new AuthGate(supabaseClient as unknown as AuthGateDeps);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

    const { unsubscribe } = authGate.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const previousUserId = localStorage.getItem(LAST_USER_ID_KEY);
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;

      if (newUserId && previousUserId && newUserId !== previousUserId) {
        const wipe = getEventStoreWipe();
        if (wipe) {
          await wipe();
        }
      }

      if (newUserId) {
        localStorage.setItem(LAST_USER_ID_KEY, newUserId);
      }

      setSession(session);
      setUser(newUser);
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
    signUp: authGate.signUp.bind(authGate),
    signIn: authGate.signIn.bind(authGate),
    signOut: authGate.signOut.bind(authGate),
    resetPassword: authGate.resetPassword.bind(authGate),
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