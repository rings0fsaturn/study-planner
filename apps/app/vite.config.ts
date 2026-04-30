import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['SUPABASE_']);
  return {
    plugins: [react()],
    base: '/study/',
    envPrefix: ['VITE_', 'SUPABASE_'],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/supabase-fn': {
          target: env.SUPABASE_URL
            ? `${env.SUPABASE_URL}/functions/v1`
            : 'http://localhost:54321/functions/v1',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/supabase-fn/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});