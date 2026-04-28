import type { User, Session } from '@supabase/supabase-js';

export interface AuthGateDeps {
  auth: {
    signUp: (options: { email: string; password: string }) => Promise<{
      data: { user: User; session: Session | null };
      error: Error | null;
    }>;
    signInWithPassword: (options: { email: string; password: string }) => Promise<{
      data: { user: User; session: Session };
      error: Error | null;
    }>;
    signOut: () => Promise<{ error: Error | null }>;
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{
      error: Error | null;
    }>;
    getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>;
    getUser: () => Promise<{ data: { user: User | null }; error: Error | null }>;
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
}

export interface SignUpResult {
  user: User | null;
  error: Error | null;
}

export interface SignInResult {
  user: User | null;
  error: Error | null;
}

export class AuthGate {
  constructor(private readonly supabase: AuthGateDeps) {}

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    return { user: data.user, error };
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { user: null, error };
    }

    if (data.user && !data.user.email_confirmed_at) {
      return {
        user: null,
        error: new Error('Email not confirmed'),
      };
    }

    return { user: data.user, error: null };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async resetPassword(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  async getUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void): { unsubscribe: () => void } {
    const { data } = this.supabase.auth.onAuthStateChange(callback);
    return { unsubscribe: data.subscription.unsubscribe };
  }
}