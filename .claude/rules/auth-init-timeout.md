---
name: auth-init-timeout
description: Add 500ms safety timeout to auth initialization to prevent React hang
---

# Auth Initialization Timeout

## Problem

When Supabase initializes auth (checking session from localStorage/cookies), it can take seconds on slow connections or when cookies are large. During this time:
- React shows no UI (blank screen or infinite spinner)
- User sees nothing — appears broken
- Navigation is blocked

This happens because `user` is `null` and `loading` stays `true` indefinitely while Supabase awaits the auth check.

## Rule

**Add a 500ms safety timeout in AuthProvider that forces `loading: false` if Supabase takes too long.**

```tsx
// AuthProvider.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase session check
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Safety timeout: force loading=false after 500ms
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, ... }}>
      {children}
    </AuthContext.Provider>
  );
}
```

## Why 500ms

- Fast enough: Most auth checks complete in <200ms
- Long enough: Covers network latency variance
- Prevents hang: Forces UI to render even on slow auth

## User Experience With Timeout

| Scenario | Without Timeout | With 500ms Timeout |
|---|---|---|
| Fast connection | Blank for 200ms → UI appears | Blank for 200ms → UI appears |
| Slow network | Blank indefinitely → broken | Blank for 500ms → form appears |
| Supabase down | App hangs forever | App shows form, auth fails gracefully |

## Pattern Checklist

- [ ] AuthProvider uses `setTimeout` to force `loading = false` after 500ms
- [ ] Return early from timeout cleanup in useEffect return function
- [ ] Loading state displays a simple "Loading..." message (not a spinner that could also hang)
- [ ] Forms render even when `loading` is true — user can see and interact

## When to Apply

- Any new AuthProvider implementation
- When auth seems to hang on page load
- When the app shows a blank screen during initial load