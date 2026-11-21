import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  formatConceptKind,
  getConceptContext,
  getConceptLabel,
  UI_COPY,
  type UiLang,
} from '../i18n';
import type { ConceptRankedDoc, IndexedDocument, OntologyConcept } from '../../server/types';

interface OntologyBrowserProps {
  concepts: OntologyConcept[];
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  docsMap: Map<string, IndexedDocument>;
  lang: UiLang;
  onOpenDoc: (docId: string) => void;
}

export function OntologyBrowser({
  concepts,
  conceptTopDocs,
  docsMap,
  lang,
  onOpenDoc,
}: OntologyBrowserProps) {
  const [query, setQuery] = useState('');
  const t = UI_COPY[lang];

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
            <h1 className="ontology-title">{t.terminology}</h1>
            <p className="ontology-sub">{t.terminologySub(concepts.length)}</p>
          </div>

          <div className="ontology-search">
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              placeholder={t.filterTerms}
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
                  <div className="ontology-term">{getConceptLabel(c, lang)}</div>
                  <span className="concept-kind" style={{ marginTop: 6 }}>
                    {formatConceptKind(c.kind, lang)}
                  </span>
                </div>

                <div>
                  <div className="concept-context" style={{ marginTop: 0 }}>
                    {getConceptContext(c, lang)}
                  </div>

                  {topDocs.length > 0 && (
                    <div className="ontology-docs">
                      <div className="panel-heading" style={{ marginBottom: 4 }}>
                        {t.topRelatedDocuments}
                      </div>
                      {topDocs.map((d) => (
                        <button
                          key={d.id}
                          className="ontology-doc-link"
                          onClick={() => onOpenDoc(d.id)}
                        >
                          <span style={{ color: 'var(--text-muted)' }}>→</span>
                          {d.title}
                        </button>
                      ))}
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
