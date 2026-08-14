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
    'SUPABASE_URL is required for dev:ingestion-worker. Set it in the shell or services/intelligence/.env.',
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is required for dev:ingestion-worker. Set it in the shell or services/intelligence/.env (never commit it).',
  );
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    'GEMINI_API_KEY is not set: extraction and chunking still run, but embedding will fail materials with provider_unavailable.',
  );
}

const child = spawn(
  'uv',
  ['run', '--package', 'intelligence', 'python', '-m', 'app.worker_main'],
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
