import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Network,
  Search,
  Settings,
} from 'lucide-react';
import { UI_COPY, type UiLang } from '../i18n';
import type { CategoryTreeNode } from '../../server/types';

export type MainView = 'reader' | 'graph' | 'ontology';
type ReviewFilter = 'all' | 'fresh';

function filterFreshTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === 'document') {
      if (node.review === 'fresh') result.push(node);
    } else if (node.children) {
      const filteredChildren = filterFreshTree(node.children);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
  }
  return result;
}

function countFreshDocs(nodes: CategoryTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'document') {
      if (node.review === 'fresh') count += 1;
    } else if (node.children) {
      count += countFreshDocs(node.children);
    }
  }
  return count;
}

interface SidebarProps {
  tree: CategoryTreeNode[];
  activeView: MainView;
  activeDocId: string | null;
  docCount: number;
  conceptCount: number;
  lang: UiLang;
  onChangeView: (view: MainView) => void;
  onSelectDoc: (docId: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

function TreeBranch({
  nodes,
  depth,
  activeDocId,
  freshLabel,
  onSelectDoc,
}: {
  nodes: CategoryTreeNode[];
  depth: number;
  activeDocId: string | null;
  freshLabel: string;
  onSelectDoc: (docId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'category') {
          const isCollapsed = !!collapsed[node.path];
          return (
            <div key={node.path}>
              <button
                className="tree-row tree-row-category"
                style={{ paddingLeft: 10 + depth * 14 }}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
                }
              >
                {isCollapsed ? (
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <span className="tree-row-label">{node.name}</span>
              </button>
              {!isCollapsed && node.children && (
                <TreeBranch
                  nodes={node.children}
                  depth={depth + 1}
                  activeDocId={activeDocId}
                  freshLabel={freshLabel}
                  onSelectDoc={onSelectDoc}
                />
              )}
            </div>
          );
        }

        const isActive = node.docId === activeDocId;
        return (
          <button
            key={node.path}
            className={`tree-row ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: 24 + depth * 14 }}
            onClick={() => node.docId && onSelectDoc(node.docId)}
          >
            <span className="tree-row-label">{node.title || node.name}</span>
            {node.review === 'fresh' && (
              <span className="tree-review-dot" title={freshLabel} aria-label={freshLabel} />
            )}
          </button>
        );
      })}
    </>
  );
}

export function Sidebar({
  tree,
  activeView,
  activeDocId,
  docCount,
  conceptCount,
  lang,
  onChangeView,
  onSelectDoc,
  onOpenSearch,
  onOpenSettings,
}: SidebarProps) {
  const t = UI_COPY[lang];
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');

  const freshCount = useMemo(() => countFreshDocs(tree), [tree]);
  const visibleTree = useMemo(
    () => (reviewFilter === 'fresh' ? filterFreshTree(tree) : tree),
    [reviewFilter, tree],
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-title">Nexus</div>
        <div className="sidebar-top-actions">
          <button className="icon-btn" onClick={onOpenSettings} title={t.settings}>
            <Settings size={17} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav-list">
        <button className="nav-item" onClick={onOpenSearch}>
          <span className="nav-item-left">
            <Search size={16} />
            <span>{t.search}</span>
          </span>
          <span className="nav-shortcut">⌘K</span>
        </button>
        <button
          className={`nav-item ${activeView === 'graph' ? 'active' : ''}`}
          onClick={() => onChangeView('graph')}
        >
          <span className="nav-item-left">
            <Network size={16} />
            <span>{t.knowledgeGraph}</span>
          </span>
        </button>
        <button
          className={`nav-item ${activeView === 'ontology' ? 'active' : ''}`}
          onClick={() => onChangeView('ontology')}
        >
          <span className="nav-item-left">
            <BookOpen size={16} />
            <span>{t.terminology}</span>
          </span>
          <span className="nav-shortcut">{conceptCount}</span>
        </button>
      </nav>

      <div className="sidebar-tree">
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">{t.documents}</span>
          <div className="sidebar-filter-pills">
            <button
              className={`sidebar-filter-btn ${reviewFilter === 'all' ? 'active' : ''}`}
              onClick={() => setReviewFilter('all')}
            >
              {t.filterAll}
            </button>
            <button
              className={`sidebar-filter-btn ${reviewFilter === 'fresh' ? 'active' : ''}`}
              onClick={() => setReviewFilter('fresh')}
            >
              {t.filterFresh}
              {freshCount > 0 ? ` (${freshCount})` : ''}
            </button>
          </div>
        </div>
        {visibleTree.length === 0 ? (
          <div className="sidebar-empty-hint">{t.noFreshDocs}</div>
        ) : (
          <TreeBranch
            nodes={visibleTree}
            depth={0}
            activeDocId={activeView === 'reader' ? activeDocId : null}
            freshLabel={t.reviewFresh}
            onSelectDoc={(docId) => {
              onSelectDoc(docId);
              onChangeView('reader');
            }}
          />
        )}
      </div>

      <div className="sidebar-footer">
        <span>{t.docsCount(docCount)}</span>
        <span>·</span>
        <span>{t.termsCount(conceptCount)}</span>
      </div>
    </aside>
  );
}
