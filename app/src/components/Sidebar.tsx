import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Network,
  Search,
  Settings,
} from 'lucide-react';
import { UI_COPY, type UiLang } from '../i18n';
import type { CategoryTreeNode } from '../../server/types';

export type MainView = 'reader' | 'graph' | 'ontology';

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
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
            <FileText
              size={13}
              style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}
            />
            <span className="tree-row-label">{node.title || node.name}</span>
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

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-title">Nexus</div>
        <div className="sidebar-top-actions">
          <button className="icon-btn" onClick={onOpenSettings} title={t.settings}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav-list">
        <button className="nav-item" onClick={onOpenSearch}>
          <span className="nav-item-left">
            <Search size={14} />
            <span>{t.search}</span>
          </span>
          <span className="kbd">⌘K</span>
        </button>
        <button
          className={`nav-item ${activeView === 'graph' ? 'active' : ''}`}
          onClick={() => onChangeView('graph')}
        >
          <span className="nav-item-left">
            <Network size={14} />
            <span>{t.knowledgeGraph}</span>
          </span>
        </button>
        <button
          className={`nav-item ${activeView === 'ontology' ? 'active' : ''}`}
          onClick={() => onChangeView('ontology')}
        >
          <span className="nav-item-left">
            <BookOpen size={14} />
            <span>{t.terminology}</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{conceptCount}</span>
        </button>
      </nav>

      <div className="sidebar-tree">
        <div className="sidebar-section-label">{t.documents}</div>
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
        <span>{t.docsCount(docCount)}</span>
        <span>·</span>
        <span>{t.termsCount(conceptCount)}</span>
      </div>
    </aside>
  );
}
