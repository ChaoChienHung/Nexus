import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nexusApiPlugin } from './server/apiPlugin';
import { resolveKnowledgeDir } from './server/config';

const { knowledgeDir, source } = resolveKnowledgeDir(__dirname);
console.log(`[nexus] Knowledge directory (${source}): ${knowledgeDir}`);

export default defineConfig({
  plugins: [
    react(),
    nexusApiPlugin({
      knowledgeDir,
    }),
  ],
  server: {
    port: 4321,
    strictPort: false,
  },
});
