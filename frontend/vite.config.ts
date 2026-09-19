import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_PORT || 5173);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port,
    },
    preview: {
      host: '0.0.0.0',
      port,
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy vendors into stable long-lived chunks. The page-level
          // lazy() splits we added in App.tsx/ConnectedLearner.tsx already
          // separate per-route code; this layer groups the framework /
          // vendor surface so a single chunk changes rarely across deploys
          // and the browser cache hits more often.
          manualChunks: {
            react: ['react', 'react-dom'],
            query: ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
            icons: ['lucide-react', '@phosphor-icons/react'],
            motion: ['framer-motion'],
            media: ['video.js', 'three'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
        },
      },
    },
  };
});
