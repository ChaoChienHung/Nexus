import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveKnowledgeDir } from './config';
import { buildNexusIndex } from './indexer';
import {
  findConceptPath,
  getConceptSubgraph,
  getDocumentDetail,
  getGraphOverview,
  listAnnotations,
  searchNexus,
  searchSections,
} from './query';

const HELP_TEXT = `Nexus Knowledge Graph Query CLI

Usage:
  npm run query -- <command> [args] [options]

Commands:
  overview                                  Compact summary of concepts, docs, categories, and counts
  search <query> [--limit N] [--type all|concept|document] [--category <path>]
                                            Search concepts (labels/aliases/contexts) & docs (BM25)
  sections <query> [--limit N] [--category <path>]
                                            Search Markdown sections (## / ###) via BM25
  subgraph <concept_id> [--hops N] [--no-docs]
                                            Get 1-3 hop concept neighborhood + related doc summaries
  path <from_id> <to_id> [--max-depth N] [--include-docs]
                                            Find shortest semantic path between two nodes
  doc <doc_id> [--comments] [--raw]         Read full Markdown body & metadata for a single document
  annotations [--all]                       List unresolved comments.json & ## 備註 entries

Global options:
  --public                                  Exclude status: draft documents
  --vault <path>                            Override NEXUS_KNOWLEDGE_DIR for this query
  --compact                                 Output single-line JSON
  -h, --help                                Show this help message
`;

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      flags.set('help', true);
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (
        ['limit', 'type', 'hops', 'max-depth', 'vault', 'category'].includes(key) &&
        next !== undefined &&
        !next.startsWith('--')
      ) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, true);
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const command = positionals[0];

  if (!command || flags.get('help')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(__dirname, '..');
  const vaultOverride = flags.get('vault');
  const knowledgeDir =
    typeof vaultOverride === 'string'
      ? path.resolve(vaultOverride)
      : resolveKnowledgeDir(appDir).knowledgeDir;

  const includeDrafts = !flags.get('public');
  const index = buildNexusIndex(knowledgeDir, { includeDrafts });
  const compact = Boolean(flags.get('compact'));

  let result: unknown;

  switch (command) {
    case 'overview': {
      result = getGraphOverview(index);
      break;
    }
    case 'search': {
      const query = positionals.slice(1).join(' ').trim();
      if (!query) {
        throw new Error('Missing search query. Usage: search <query>');
      }
      const limitRaw = flags.get('limit');
      const typeRaw = flags.get('type');
      const categoryRaw = flags.get('category');
      const type =
        typeRaw === 'concept' || typeRaw === 'document' || typeRaw === 'all'
          ? typeRaw
          : 'all';
      result = searchNexus(index, query, {
        limit: typeof limitRaw === 'string' ? Number(limitRaw) : undefined,
        type,
        category: typeof categoryRaw === 'string' ? categoryRaw : undefined,
      });
      break;
    }
    case 'sections': {
      const query = positionals.slice(1).join(' ').trim();
      if (!query) {
        throw new Error('Missing search query. Usage: sections <query>');
      }
      const limitRaw = flags.get('limit');
      const categoryRaw = flags.get('category');
      result = searchSections(index, query, {
        limit: typeof limitRaw === 'string' ? Number(limitRaw) : undefined,
        category: typeof categoryRaw === 'string' ? categoryRaw : undefined,
      });
      break;
    }
    case 'subgraph': {
      const conceptId = positionals[1];
      if (!conceptId) {
        throw new Error('Missing concept_id. Usage: subgraph <concept_id>');
      }
      const hopsRaw = flags.get('hops');
      result = getConceptSubgraph(index, conceptId, {
        hops: typeof hopsRaw === 'string' ? Number(hopsRaw) : undefined,
        includeDocs: !flags.get('no-docs'),
      });
      break;
    }
    case 'path': {
      const fromId = positionals[1];
      const toId = positionals[2];
      if (!fromId || !toId) {
        throw new Error('Missing node IDs. Usage: path <from_id> <to_id>');
      }
      const maxDepthRaw = flags.get('max-depth');
      result = findConceptPath(index, fromId, toId, {
        maxDepth: typeof maxDepthRaw === 'string' ? Number(maxDepthRaw) : undefined,
        includeDocs: flags.get('include-docs') ? true : undefined,
      });
      break;
    }
    case 'doc': {
      const docId = positionals[1];
      if (!docId) {
        throw new Error('Missing doc_id. Usage: doc <doc_id>');
      }
      result = getDocumentDetail(index, docId, {
        includeComments: Boolean(flags.get('comments')),
        includeRaw: Boolean(flags.get('raw')),
      });
      break;
    }
    case 'annotations': {
      result = listAnnotations(index, {
        includeResolved: Boolean(flags.get('all')),
      });
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}. Run with --help for usage.`);
  }

  console.log(compact ? JSON.stringify(result) : JSON.stringify(result, null, 2));
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}
