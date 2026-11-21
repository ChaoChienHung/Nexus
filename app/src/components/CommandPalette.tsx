import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type {
  IndexedDocument,
  OntologyConcept,
  ReferenceItem,
} from '../../server/types';

interface SearchEntry {
  id: string;
  type: 'document' | 'concept' | 'reference';
  title: string;
  subtitle: string;
  searchText: string;
  url?: string;
}

interface CommandPaletteProps {
  open: boolean;
  documents: IndexedDocument[];
  concepts: OntologyConcept[];
  references: ReferenceItem[];
  onClose: () => void;
  onSelectDoc: (docId: string) => void;
  onSelectConcept: (conceptId: string) => void;
}

export function CommandPalette({
  open,
  documents,
  concepts,
  references,
  onClose,
  onSelectDoc,
  onSelectConcept,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const entries = useMemo<SearchEntry[]>(() => {
    const list: SearchEntry[] = [];
    for (const d of documents) {
      list.push({
        id: d.id,
        type: 'document',
        title: d.title,
        subtitle: `${d.categoryPath.join(' / ')} — ${d.summary}`,
        searchText: `${d.title} ${d.summary} ${d.categoryPath.join(' ')} ${d.body}`.toLowerCase(),
      });
    }
    for (const c of concepts) {
      list.push({
        id: c.concept_id,
        type: 'concept',
        title: `${c.labels['zh-Hant']} (${c.labels.en})`,
        subtitle: c.contexts['zh-Hant'] || c.contexts.en,
        searchText: `${c.concept_id} ${c.labels.en} ${c.labels['zh-Hant']} ${c.labels['zh-Hans'] ?? ''} ${(c.aliases ?? []).join(' ')} ${c.contexts.en} ${c.contexts['zh-Hant']}`.toLowerCase(),
      });
    }
    for (const r of references) {
      list.push({
        id: r.ref_id,
        type: 'reference',
        title: r.title,
        subtitle: `${r.authors?.join(', ') ?? ''} ${r.year ? `(${r.year})` : ''}`.trim(),
        searchText: `${r.ref_id} ${r.title} ${(r.authors ?? []).join(' ')} ${r.notes ?? ''}`.toLowerCase(),
        url: r.url,
      });
    }
    return list;
  }, [documents, concepts, references]);

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
    } else if (entry.url) {
      window.open(entry.url, '_blank', 'noreferrer');
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
            placeholder="Search documents, terminology, or references..."
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

        <div className="cmd-results">
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No matching documents, concepts, or references.
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
