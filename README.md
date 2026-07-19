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

The service verifies Supabase access JWTs on `/v1/*`. Set the JWT signing secret
and project URL in the shell or in `services/intelligence/.env` before starting
the full stack:

```bash
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_JWT_SECRET=<project JWT secret>
pnpm dev:full
```

Or create `services/intelligence/.env`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_JWT_SECRET=<project JWT secret>
```

Use the Supabase project JWT secret from the dashboard, not the publishable/anon
key or service role key. For projects using Supabase asymmetric signing keys
(`ES256`/`RS256`), `SUPABASE_URL` is used to fetch the public JWKS verification
keys from Supabase.

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

Run the service with Docker Compose:

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_JWT_SECRET=<project JWT secret> \
  docker compose up --build
```
