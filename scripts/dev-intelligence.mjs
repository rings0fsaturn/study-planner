import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { config, parse } from 'dotenv';

config({ path: 'services/intelligence/.env', quiet: true });

if (!process.env.SUPABASE_URL && existsSync('apps/app/.env.local')) {
  const appEnv = parse(readFileSync('apps/app/.env.local'));
  if (appEnv.SUPABASE_URL) {
    process.env.SUPABASE_URL = appEnv.SUPABASE_URL;
  }
}

if (!process.env.SUPABASE_URL) {
  console.error(
    'SUPABASE_URL is required for dev:intelligence. Set it in the shell or services/intelligence/.env.',
  );
  process.exit(1);
}

if (!process.env.SUPABASE_JWT_SECRET) {
  console.warn(
    'SUPABASE_JWT_SECRET is not set. This project verifies ES256/RS256 tokens via the JWKS endpoint (SUPABASE_URL), so this is fine. If this project ever signs HS256 tokens, set the Supabase project JWT secret in the shell or services/intelligence/.env (not the anon or service role key).',
  );
}

const child = spawn(
  'uv',
  ['run', '--package', 'intelligence', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'],
  {
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
