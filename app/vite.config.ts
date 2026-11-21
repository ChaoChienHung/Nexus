import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { nexusApiPlugin } from './server/apiPlugin';

export default defineConfig({
  plugins: [
    react(),
    nexusApiPlugin({
      knowledgeDir: path.resolve(__dirname, '../knowledge'),
    }),
  ],
  server: {
    port: 4321,
    strictPort: false,
  },
});
