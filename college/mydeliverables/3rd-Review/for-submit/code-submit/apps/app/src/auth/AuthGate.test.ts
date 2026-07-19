import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGate, type AuthGateDeps } from './AuthGate';

interface FakeUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

interface FakeSession {
  access_token: string;
  user: FakeUser;
}

interface FakeSupabaseClient {
  auth: {
    signUp: (options: { email: string; password: string }) => Promise<{
      data: { user: FakeUser; session: FakeSession | null };
      error: Error | null;
    }>;
    signInWithPassword: (options: { email: string; password: string }) => Promise<{
      data: { user: FakeUser; session: FakeSession };
      error: Error | null;
    }>;
    signOut: () => Promise<{ error: Error | null }>;
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{
      error: Error | null;
    }>;
    getSession: () => Promise<{ data: { session: FakeSession | null }; error: Error | null }>;
    getUser: () => Promise<{ data: { user: FakeUser | null }; error: Error | null }>;
    onAuthStateChange: (callback: (event: string, session: FakeSession | null) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
  _createConfirmedUser?: (email: string) => void;
}

function createFakeSupabase(): FakeSupabaseClient {
  const users = new Map<string, FakeUser>();
  let currentSession: FakeSession | null = null;
  const listeners: Set<(event: string, session: FakeSession | null) => void> = new Set();

  const triggerAuthStateChange = (event: string, session: FakeSession | null) => {
    listeners.forEach(cb => cb(event, session));
  };

  return {
    auth: {
      signUp: async ({ email, password: _password }) => {
        const user: FakeUser = {
          id: crypto.randomUUID(),
          email,
          email_confirmed_at: null,
        };
        users.set(email, user);
        return {
          data: { user, session: null },
          error: null,
        };
      },
      signInWithPassword: async ({ email, password: _password }) => {
        const user = users.get(email);
        if (!user) {
          return {
            data: { user: null as unknown as FakeUser, session: null as unknown as FakeSession },
            error: new Error('Invalid login credentials'),
          };
        }
        if (!user.email_confirmed_at) {
          return {
            data: { user, session: null as unknown as FakeSession },
            error: new Error('Email not confirmed'),
          };
        }
        const session: FakeSession = {
          access_token: crypto.randomUUID(),
          user,
        };
        currentSession = session;
        triggerAuthStateChange('SIGNED_IN', session);
        return { data: { user, session }, error: null };
      },
      signOut: async () => {
        currentSession = null;
        triggerAuthStateChange('SIGNED_OUT', null);
        return { error: null };
      },
      resetPasswordForEmail: async (email) => {
        if (!users.has(email)) {
          return { error: new Error('User not found') };
        }
        return { error: null };
      },
      getSession: async () => {
        return { data: { session: currentSession }, error: null };
      },
      getUser: async () => {
        return { data: { user: currentSession?.user ?? null }, error: null };
      },
      onAuthStateChange: (callback) => {
        listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => { listeners.delete(callback); },
            },
          },
        };
      },
    },
    _createConfirmedUser: (email) => {
      const user: FakeUser = {
        id: crypto.randomUUID(),
        email,
        email_confirmed_at: new Date().toISOString(),
      };
      users.set(email, user);
    },
  };
}

describe('AuthGate', () => {
  let fakeSupabase: FakeSupabaseClient;

  beforeEach(() => {
    fakeSupabase = createFakeSupabase();
  });

  it('signUp creates a user in Supabase auth', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);

    const result = await authGate.signUp('test@example.com', 'password123');

    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe('test@example.com');
    expect(result.error).toBeNull();
  });

  it('signIn rejects unconfirmed email', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);

    await authGate.signUp('test@example.com', 'password123');
    const result = await authGate.signIn('test@example.com', 'password123');

    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Email not confirmed');
    expect(result.user).toBeNull();
  });

  it('signIn succeeds for confirmed user', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);

    fakeSupabase._createConfirmedUser!('test@example.com');

    const result = await authGate.signIn('test@example.com', 'password123');

    expect(result.error).toBeNull();
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe('test@example.com');
  });

  it('signOut clears the session', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);

    fakeSupabase._createConfirmedUser!('test@example.com');
    await authGate.signIn('test@example.com', 'password123');
    const sessionBefore = await authGate.getSession();
    expect(sessionBefore).toBeDefined();

    await authGate.signOut();
    const sessionAfter = await authGate.getSession();

    expect(sessionAfter).toBeNull();
  });

  it('resetPassword calls Supabase reset flow', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);

    await authGate.signUp('test@example.com', 'password123');
    const result = await authGate.resetPassword('test@example.com');

    expect(result.error).toBeNull();
  });

  it('onAuthStateChange fires SIGNED_IN and SIGNED_OUT events', async () => {
    const authGate = new AuthGate(fakeSupabase as unknown as AuthGateDeps);
    const callback = vi.fn();

    authGate.onAuthStateChange(callback);

    fakeSupabase._createConfirmedUser!('test@example.com');
    await authGate.signIn('test@example.com', 'password123');
    expect(callback).toHaveBeenCalledWith('SIGNED_IN', expect.any(Object));

    await authGate.signOut();
    expect(callback).toHaveBeenCalledWith('SIGNED_OUT', null);
  });
});