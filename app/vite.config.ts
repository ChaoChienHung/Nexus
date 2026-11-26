import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nexusApiPlugin } from './server/apiPlugin';
import { resolveKnowledgeDir, resolveMentorionConfig } from './server/config';

const { knowledgeDir, source } = resolveKnowledgeDir(__dirname);
const { apiUrl: mentorionApiUrl, source: mentorionSource } = resolveMentorionConfig(__dirname);
console.log(`[nexus] Knowledge directory (${source}): ${knowledgeDir}`);
if (mentorionApiUrl) {
  console.log(`[nexus] Mentorion integration (${mentorionSource}): ${mentorionApiUrl}`);
}

export default defineConfig({
  plugins: [
    react(),
    nexusApiPlugin({
      knowledgeDir,
      knowledgeSource: source,
      mentorionApiUrl,
    }),
  ],
  server: {
    port: 4321,
    strictPort: false,
  },
});
