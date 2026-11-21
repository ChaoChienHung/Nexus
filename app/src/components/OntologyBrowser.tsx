import { useMemo, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import type { IndexedDocument, OntologyConcept } from '../../server/types';

interface OntologyBrowserProps {
  concepts: OntologyConcept[];
  documents: IndexedDocument[];
  onOpenDoc: (docId: string) => void;
}

export function OntologyBrowser({
  concepts,
  documents,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Ontology Concepts</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Canonical semantic backbone from <code>knowledge/data/ontology/concepts.json</code>
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 12px',
              width: 260,
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
              placeholder="Filter concepts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="ontology-grid">
          {filtered.map((c) => {
            const linkedDocs = documents.filter(
              (d) =>
                d.concepts.includes(c.concept_id) ||
                d.mentionedConcepts.includes(c.concept_id),
            );
            return (
              <div key={c.concept_id} className="concept-card-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="concept-kind">{c.kind ?? 'concept'}</span>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.concept_id}</code>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{c.labels['zh-Hant']}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{c.labels.en}</div>
                </div>
                <div className="concept-context">{c.contexts['zh-Hant']}</div>
                <div className="concept-context en">{c.contexts.en}</div>

                {linkedDocs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {linkedDocs.map((d) => (
                      <button
                        key={d.id}
                        className="doc-link-pill"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => onOpenDoc(d.id)}
                      >
                        <FileText size={12} />
                        {d.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
