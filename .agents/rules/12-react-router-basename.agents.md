---
name: react-router-basename
description: Keep the `/study` deployment prefix out of application route declarations and navigation calls.
---

# React Router Basename

`apps/app/src/App.tsx` owns `<BrowserRouter basename="/study">`.
Write route paths, links, redirects, and `navigate()` calls as if the application were mounted at `/`.

```tsx
<Route path="/sign-in" element={<SignIn />} />
<Navigate to="/sign-in" />
navigate('/sign-in')
<Link to="/sign-in">Sign in</Link>
```

Never include `/study` in router-owned application paths.
Including it produces duplicated URLs such as `/study/study/sign-in`.

Use the deployed `/study/...` URL only at browser, server, rewrite, or external-link boundaries.
Keep the basename spelling consistent and verify redirects through a browser test when routing changes.
