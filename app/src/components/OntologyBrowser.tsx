import { useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import type { ConceptRankedDoc, IndexedDocument, OntologyConcept } from '../../server/types';

interface OntologyBrowserProps {
  concepts: OntologyConcept[];
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  docsMap: Map<string, IndexedDocument>;
  onOpenDoc: (docId: string) => void;
}

export function OntologyBrowser({
  concepts,
  conceptTopDocs,
  docsMap,
  onOpenDoc,
}: OntologyBrowserProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return concepts;
    return concepts.filter((c) => {
      const hay = [
        c.concept_id,
        c.labels.en,
        c.labels['zh-Hant'],
        c.labels['zh-Hans'] ?? '',
        ...(c.aliases ?? []),
        c.contexts.en,
        c.contexts['zh-Hant'],
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [concepts, query]);

  return (
    <main className="main-pane">
      <div className="ontology-view">
        <div className="ontology-header">
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.025em' }}>Terminology</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
              {concepts.length} canonical concepts across your knowledge base
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 11px',
              width: 240,
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                width: '100%',
              }}
              placeholder="Filter terms..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="ontology-list">
          {filtered.map((c) => {
            const topDocs = (conceptTopDocs[c.concept_id] ?? [])
              .map((r) => docsMap.get(r.docId))
              .filter((d): d is IndexedDocument => !!d);
            return (
              <div key={c.concept_id} className="ontology-row">
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.labels['zh-Hant']}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {c.labels.en}
                  </div>
                  <span className="concept-kind" style={{ marginTop: 8 }}>
                    {c.kind ?? 'concept'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="concept-context">{c.contexts['zh-Hant']}</div>
                  <div className="concept-context en">{c.contexts.en}</div>

                  {topDocs.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 550, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Top Related Documents
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {topDocs.map((d) => (
                          <button
                            key={d.id}
                            className="doc-link-pill"
                            style={{ padding: '4px 9px', fontSize: 12 }}
                            onClick={() => onOpenDoc(d.id)}
                          >
                            <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                            {d.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
