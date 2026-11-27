import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getConceptContext, getConceptLabel, UI_COPY, type UiLang } from '../i18n';
import type {
  IndexedDocument,
  OntologyConcept,
} from '../../server/types';

interface SearchEntry {
  id: string;
  type: 'document' | 'concept';
  title: string;
  subtitle: string;
  searchText: string;
}

interface CommandPaletteProps {
  open: boolean;
  lang: UiLang;
  documents: IndexedDocument[];
  concepts: OntologyConcept[];
  onClose: () => void;
  onSelectDoc: (docId: string) => void;
  onSelectConcept: (conceptId: string) => void;
}

export function CommandPalette({
  open,
  lang,
  documents,
  concepts,
  onClose,
  onSelectDoc,
  onSelectConcept,
}: CommandPaletteProps) {
  const t = UI_COPY[lang];
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [categoryScope, setCategoryScope] = useState<string>('all');

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) {
      if (d.categoryPath[0]) set.add(d.categoryPath[0]);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const entries = useMemo<SearchEntry[]>(() => {
    const scopedDocs =
      categoryScope === 'all'
        ? documents
        : documents.filter((d) => d.categoryPath[0] === categoryScope);
    const scopedConceptIds =
      categoryScope === 'all'
        ? null
        : new Set(scopedDocs.flatMap((d) => [...d.concepts, ...d.mentionedConcepts]));

    const list: SearchEntry[] = [];
    for (const d of scopedDocs) {
      list.push({
        id: d.id,
        type: 'document',
        title: d.title,
        subtitle: `${d.categoryPath.join(' / ')} — ${d.summary}`,
        searchText: `${d.title} ${d.summary} ${d.categoryPath.join(' ')} ${d.body}`.toLowerCase(),
      });
    }
    for (const c of concepts) {
      if (scopedConceptIds && !scopedConceptIds.has(c.concept_id)) continue;
      list.push({
        id: c.concept_id,
        type: 'concept',
        title: getConceptLabel(c, lang),
        subtitle: getConceptContext(c, lang),
        searchText: `${c.concept_id} ${c.labels.en} ${c.labels['zh-Hant']} ${c.labels['zh-Hans'] ?? ''} ${(c.aliases ?? []).join(' ')} ${c.contexts.en} ${c.contexts['zh-Hant']}`.toLowerCase(),
      });
    }
    return list;
  }, [documents, concepts, lang, categoryScope]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 12);
    return entries.filter((e) => e.searchText.includes(q)).slice(0, 15);
  }, [entries, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  function activate(entry: SearchEntry) {
    if (entry.type === 'document') {
      onSelectDoc(entry.id);
    } else if (entry.type === 'concept') {
      onSelectConcept(entry.id);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus
            className="cmd-input"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                activate(results[selectedIndex]);
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        {categories.length > 1 && (
          <div className="cmd-scope-bar">
            <button
              type="button"
              className={`sidebar-filter-btn ${categoryScope === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryScope('all')}
            >
              {t.scopeAllCategories}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`sidebar-filter-btn ${categoryScope === cat ? 'active' : ''}`}
                onClick={() => setCategoryScope(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="cmd-results">
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {t.noSearchResults}
            </div>
          ) : (
            results.map((entry, idx) => (
              <button
                key={`${entry.type}-${entry.id}`}
                className={`cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => activate(entry)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="cmd-item-title">{entry.title}</div>
                  <div className="cmd-item-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.subtitle}
                  </div>
                </div>
                <span className={`cmd-type-tag ${entry.type}`}>{entry.type}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
