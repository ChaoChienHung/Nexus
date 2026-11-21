import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Moon,
  Network,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { CategoryTreeNode } from '../../server/types';

export type MainView = 'reader' | 'graph' | 'ontology';

interface SidebarProps {
  tree: CategoryTreeNode[];
  activeView: MainView;
  activeDocId: string | null;
  docCount: number;
  conceptCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onChangeView: (view: MainView) => void;
  onSelectDoc: (docId: string) => void;
  onOpenSearch: () => void;
}

function TreeBranch({
  nodes,
  depth,
  activeDocId,
  onSelectDoc,
}: {
  nodes: CategoryTreeNode[];
  depth: number;
  activeDocId: string | null;
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
                className="tree-row"
                style={{ paddingLeft: 8 + depth * 14 }}
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
                }
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <Folder size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span className="tree-row-label">{node.name}</span>
              </button>
              {!isCollapsed && node.children && (
                <TreeBranch
                  nodes={node.children}
                  depth={depth + 1}
                  activeDocId={activeDocId}
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
            style={{ paddingLeft: 14 + depth * 14 }}
            onClick={() => node.docId && onSelectDoc(node.docId)}
          >
            <FileText size={14} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
            <span className="tree-row-label">{node.title || node.name}</span>
            {node.status && <span className={`status-dot ${node.status}`} title={node.status} />}
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
  theme,
  onToggleTheme,
  onChangeView,
  onSelectDoc,
  onOpenSearch,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-row">
          <div className="brand-title">Nexus</div>
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to paper light theme'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>

        <button className="search-trigger" onClick={onOpenSearch}>
          <span className="search-trigger-left">
            <Search size={13} />
            <span>Search...</span>
          </span>
          <span className="kbd">⌘K</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-pill ${activeView === 'reader' ? 'active' : ''}`}
          onClick={() => onChangeView('reader')}
        >
          <BookOpen size={13} />
          Reader
        </button>
        <button
          className={`nav-pill ${activeView === 'graph' ? 'active' : ''}`}
          onClick={() => onChangeView('graph')}
        >
          <Network size={13} />
          Graph
        </button>
        <button
          className={`nav-pill ${activeView === 'ontology' ? 'active' : ''}`}
          onClick={() => onChangeView('ontology')}
        >
          <Sparkles size={13} />
          Ontology
        </button>
      </nav>

      <div className="sidebar-tree">
        <div className="sidebar-section-label">Knowledge Tree</div>
        <TreeBranch
          nodes={tree}
          depth={0}
          activeDocId={activeView === 'reader' ? activeDocId : null}
          onSelectDoc={(docId) => {
            onSelectDoc(docId);
            onChangeView('reader');
          }}
        />
      </div>

      <div className="sidebar-footer">
        <span>{docCount} docs</span>
        <span>{conceptCount} concepts</span>
      </div>
    </aside>
  );
}
