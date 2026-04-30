# React Router v7 — `basename` Behavior Clarification

> **Sources consulted:**
> - https://reactrouter.com/api/declarative-routers/BrowserRouter
> - https://reactrouter.com/api/hooks/useNavigate
> - https://reactrouter.com/6.30.3/routers/create-browser-router *(contains the definitive `basename` + `<Link>` resolution example)*
> - https://github.com/remix-run/react-router/discussions/10679 *(trailing slash edge case)*

---

## The One Rule That Governs Everything

> **`basename` is transparent to all navigation APIs.**

You write paths as if the basename doesn't exist. React Router automatically prepends it when resolving the final browser URL. You **never** include the basename in your `to` values.

**Proof from the official `createBrowserRouter` docs:**

```
createBrowserRouter(routes, { basename: "/app" });

<Link to="/" />   // results in → <a href="/app" />
<Link to="/" />   // NOT        → <a href="/" />
```

The router adds the basename. If you add it yourself too, it doubles.

---

## Answers to All Three Questions

Setup: `<BrowserRouter basename="/study">`

### Q1 — `<Navigate to="..." />`

| `to` value | Final browser URL | Result |
|---|---|---|
| `to="/sign-in"` | `/study/sign-in` | ✅ Correct |
| `to="/study/sign-in"` | `/study/study/sign-in` | ❌ Double basename |

**Answer: option (a)** — `to` is treated as absolute within the router's hierarchy. The router prepends `/study` automatically. If you pass `/study/sign-in`, it becomes `/study/study/sign-in`.

---

### Q2 — `useNavigate()` hook

```js
const navigate = useNavigate();

navigate('/sign-in')         // → /study/sign-in   ✅
navigate('/study/sign-in')   // → /study/study/sign-in  ❌
```

**Answer: same as Q1.** The `navigate()` function does **not** strip a basename prefix you accidentally include — it resolves the path within the router context and prepends the basename on top.

> Source: https://reactrouter.com/api/hooks/useNavigate
> *"The navigate function accepts a URL path string... within the router context."*

---

### Q3 — `<Link to="..." />`

```jsx
<Link to="/sign-in">Login</Link>      {/* → <a href="/study/sign-in">   ✅ */}
<Link to="/study/sign-in">Login</Link> {/* → <a href="/study/study/sign-in">  ❌ */}
```

**Answer: same as Q1 and Q2.** `<Link>` resolves paths the same way — the `to` prop is scoped to the router hierarchy, and the basename is appended automatically.

> Source: https://reactrouter.com/6.30.3/routers/create-browser-router
> *(The `<Link to="/">` → `/app` example directly demonstrates this for Link)*

---

## Summary Table

| API | Write this | Browser gets | ✅/❌ |
|---|---|---|---|
| `<Navigate>` | `to="/sign-in"` | `/study/sign-in` | ✅ |
| `<Navigate>` | `to="/study/sign-in"` | `/study/study/sign-in` | ❌ |
| `navigate()` | `'/sign-in'` | `/study/sign-in` | ✅ |
| `navigate()` | `'/study/sign-in'` | `/study/study/sign-in` | ❌ |
| `<Link>` | `to="/sign-in"` | `/study/sign-in` | ✅ |
| `<Link>` | `to="/study/sign-in"` | `/study/study/sign-in` | ❌ |

---

## The Correct Pattern

```jsx
// ✅ Correct setup — write routes and links as if deployed at root
<BrowserRouter basename="/study">
  <Routes>
    {/* This matches the browser URL /study/sign-in */}
    <Route path="/sign-in" element={<SignIn />} />
    <Route path="/dashboard" element={<Dashboard />} />
  </Routes>
</BrowserRouter>

// Inside any component — never include "/study" yourself:
<Navigate to="/sign-in" />
navigate('/sign-in')
<Link to="/sign-in">Login</Link>
```

---

## Edge Case: Trailing Slash in Basename

> Source: https://github.com/remix-run/react-router/discussions/10679

The trailing slash on `basename` itself is preserved and affects how `<Link to="/">` resolves:

| `basename` value | `<Link to="/">` resolves to |
|---|---|
| `"/study"` | `/study` (no trailing slash) |
| `"/study/"` | `/study/` (with trailing slash) |

Be consistent — pick one and stick with it across your router config.

---

## Mental Model

Think of `basename` as a **deployment prefix** — it's an infrastructure concern, not an app-logic concern. Inside the router, your entire world starts at `/`. The basename is only the router's business, never yours.

```
Browser URL space:    /study/sign-in
                      ^^^^^^ ^^^^^^^^
                      basename  your route path ("/sign-in")
                      (router)  (what you write in `to`)
```
