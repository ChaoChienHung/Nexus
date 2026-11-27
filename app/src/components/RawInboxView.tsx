import { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Inbox,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { UI_COPY, type UiLang } from '../i18n';
import type { RawFileEntry } from '../../server/types';

interface RawInboxViewProps {
  rawFiles: RawFileEntry[];
  lang: UiLang;
  onUploadFile: (file: File, subfolder?: string) => Promise<void>;
  onDeleteFile: (relPath: string) => Promise<void>;
  onOpenDoc: (docId: string) => void;
  onNotify: (message: string) => void;
}

type StatusFilter = 'all' | 'pending' | 'compiled';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RawInboxView({
  rawFiles,
  lang,
  onUploadFile,
  onDeleteFile,
  onOpenDoc,
  onNotify,
}: RawInboxViewProps) {
  const t = UI_COPY[lang];
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [subfolder, setSubfolder] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingCount = useMemo(
    () => rawFiles.filter((f) => f.status === 'pending').length,
    [rawFiles],
  );
  const compiledCount = rawFiles.length - pendingCount;

  const visibleFiles = useMemo(() => {
    if (filter === 'all') return rawFiles;
    return rawFiles.filter((f) => f.status === filter);
  }, [rawFiles, filter]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        await onUploadFile(file, subfolder.trim() || undefined);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleCopyRef(entry: RawFileEntry) {
    const mdRef = `[${entry.name}](raw/${entry.relPath})`;
    try {
      await navigator.clipboard.writeText(mdRef);
      setCopiedPath(entry.relPath);
      onNotify(t.rawCopiedRef);
      window.setTimeout(() => setCopiedPath((curr) => (curr === entry.relPath ? null : curr)), 1800);
    } catch {
      onNotify('Failed to copy');
    }
  }

  function buildRawUrl(relPath: string): string {
    return `/api/raw/${relPath
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/')}`;
  }

  return (
    <main className="main-pane">
      <div className="ontology-view raw-inbox-view">
        <div className="ontology-header">
          <div>
            <h1 className="ontology-title">{t.rawInboxTitle}</h1>
            <p className="ontology-sub">{t.rawInboxSub}</p>
          </div>
          <div className="sidebar-filter-pills" style={{ flexShrink: 0 }}>
            <button
              className={`sidebar-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              {t.rawStatusAll} ({rawFiles.length})
            </button>
            <button
              className={`sidebar-filter-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              {t.rawStatusPending} ({pendingCount})
            </button>
            <button
              className={`sidebar-filter-btn ${filter === 'compiled' ? 'active' : ''}`}
              onClick={() => setFilter('compiled')}
            >
              {t.rawStatusCompiled} ({compiledCount})
            </button>
          </div>
        </div>

        <div
          className={`raw-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) {
              void handleFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) {
                void handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <UploadCloud size={26} style={{ color: 'var(--accent)' }} />
          <div className="raw-dropzone-text">
            {uploading ? t.saving : t.rawDropHint}
          </div>
          <div
            className="raw-subfolder-row"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="raw-subfolder-prefix">raw/</span>
            <input
              type="text"
              className="raw-subfolder-input"
              placeholder={t.rawSubfolderPlaceholder}
              value={subfolder}
              onChange={(e) => setSubfolder(e.target.value)}
            />
          </div>
        </div>

        {visibleFiles.length === 0 ? (
          <div className="raw-empty-state">
            <Inbox size={28} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
            <p>{t.rawEmpty}</p>
          </div>
        ) : (
          <div className="raw-file-list">
            {visibleFiles.map((entry) => (
              <div key={entry.relPath} className="raw-file-row">
                <div className="raw-file-main">
                  <div className="raw-file-title-row">
                    <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <a
                      className="raw-file-name"
                      href={buildRawUrl(entry.relPath)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.relPath}
                    </a>
                    <span className={`raw-status-badge ${entry.status}`}>
                      {entry.status === 'compiled' ? t.rawStatusCompiled : t.rawStatusPending}
                    </span>
                  </div>
                  <div className="raw-file-meta">
                    <span>{formatBytes(entry.size)}</span>
                    <span>·</span>
                    <span>{entry.modified}</span>
                    {entry.referencedBy.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="raw-ref-docs">
                          {entry.referencedBy.map((ref) => (
                            <button
                              key={ref.docId}
                              type="button"
                              className="raw-ref-doc-pill"
                              onClick={() => onOpenDoc(ref.docId)}
                            >
                              → {ref.title}
                            </button>
                          ))}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="raw-file-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title={t.rawCopyRef}
                    onClick={() => void handleCopyRef(entry)}
                  >
                    {copiedPath === entry.relPath ? (
                      <Check size={15} style={{ color: 'var(--doc-color)' }} />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <a
                    className="icon-btn"
                    href={buildRawUrl(entry.relPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t.rawOpenFile}
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm(`${t.rawDeleteConfirm}\n\nraw/${entry.relPath}`)) {
                        void onDeleteFile(entry.relPath);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
