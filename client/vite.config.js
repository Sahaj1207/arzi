import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite runs on 5173 and forwards /api to the Express server on 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
