# React Router v7 — `basename` Behavior

**Rule: `basename` is transparent to all navigation APIs — write `to`/`navigate()` paths as
if the basename doesn't exist. The router prepends it automatically. Never include `/study`
yourself in `<Navigate>`, `useNavigate()`, or `<Link>` — doing so doubles the prefix.**

Setup: `<BrowserRouter basename="/study">`. This holds identically for all three APIs —
none of them strip a basename prefix you accidentally include; all three prepend it on top.

| Write this | Browser gets | |
|---|---|---|
| `to="/sign-in"` | `/study/sign-in` | correct |
| `to="/study/sign-in"` | `/study/study/sign-in` | wrong — doubled |

```jsx
// Correct — write routes/links as if deployed at root; never include "/study" yourself
<BrowserRouter basename="/study">
  <Routes>
    <Route path="/sign-in" element={<SignIn />} />  {/* matches /study/sign-in */}
  </Routes>
</BrowserRouter>

<Navigate to="/sign-in" />
navigate('/sign-in')
<Link to="/sign-in">Login</Link>
```

**Edge case:** a trailing slash on `basename` itself is preserved — `basename="/study/"`
makes `<Link to="/">` resolve to `/study/` instead of `/study`. Pick one and stay consistent.

**Mental model:** `basename` is a deployment prefix, not app logic. Inside the router your
world starts at `/`; the basename is the router's business alone.

Sources: [BrowserRouter](https://reactrouter.com/api/declarative-routers/BrowserRouter),
[useNavigate](https://reactrouter.com/api/hooks/useNavigate),
[createBrowserRouter basename example](https://reactrouter.com/6.30.3/routers/create-browser-router),
[trailing-slash discussion](https://github.com/remix-run/react-router/discussions/10679).
