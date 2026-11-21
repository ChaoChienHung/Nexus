import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNexusIndex } from './indexer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDir = path.resolve(__dirname, '../../knowledge');
const outDir = path.resolve(__dirname, '../.generated');
const outFile = path.join(outDir, 'nexus-index.json');

const includeDrafts = !process.argv.includes('--public');
const index = buildNexusIndex(knowledgeDir, { includeDrafts });

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');

console.log(
  `[nexus-indexer] Indexed ${index.documents.length} docs, ${index.concepts.length} concepts, ` +
  `${index.references.length} refs, ${index.graph.edges.length} edges -> ${path.relative(process.cwd(), outFile)}`,
);

if (index.warnings.length > 0) {
  console.warn(`[nexus-indexer] Warnings (${index.warnings.length}):`);
  for (const w of index.warnings) {
    console.warn(`  - ${w}`);
  }
}
