# Study Tracker Web

Mobile-first study planning app with an Astro marketing site, a React app under
`/study`, and a FastAPI Intelligence Service for calibration/progress engines.

## Development

Run the React app and Intelligence Service together:

```bash
pnpm dev:full
```

`pnpm dev:full` starts the service on `http://localhost:8000`, waits for
`/health`, then starts the Vite app on `http://localhost:5173/study/`.
Calibration requires the service to be running.

The service verifies Supabase access JWTs on `/v1/*`. Set the project URL in
the shell or in `services/intelligence/.env` before starting the full stack:

```bash
export SUPABASE_URL=https://<project>.supabase.co
pnpm dev:full
```

Or create `services/intelligence/.env`:

```bash
SUPABASE_URL=https://<project>.supabase.co
```

For projects using Supabase asymmetric signing keys (`ES256`/`RS256`),
`SUPABASE_URL` is used to fetch the public JWKS verification keys from
Supabase; no `SUPABASE_JWT_SECRET` is needed. HS256-signed projects must set
the Supabase project JWT secret (from the dashboard, not the anon or service
role key) in the shell or in `services/intelligence/.env`.

The React app uses `VITE_INTELLIGENCE_URL` from `apps/app/.env.local` and
defaults to `http://localhost:8000`.

## Alternatives

Run only the frontends:

```bash
pnpm dev
```

Run only the Intelligence Service:

```bash
pnpm dev:intelligence
```

Run the whole stack (marketing site + React app + Intelligence Service) with
Docker:

```bash
cp docker/.env.example .env   # fill in SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
docker compose up --build -d
```

The app is served at `http://localhost:8080/study/` and the service health is at
`http://localhost:8000/health`. The browser reaches the service through the same
origin (`/api/v1/...` via nginx), so no extra CORS configuration is required.
