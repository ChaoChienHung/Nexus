import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  GraphEdge,
  GraphNode,
  IndexedDocument,
  OntologyConcept,
  ReferenceItem,
} from '../../server/types';

type GraphMode = 'full' | 'concepts' | 'local';

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeDocId: string | null;
  theme: 'light' | 'dark';
  conceptsMap: Map<string, OntologyConcept>;
  docsMap: Map<string, IndexedDocument>;
  refsMap: Map<string, ReferenceItem>;
  onOpenDoc: (docId: string) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const NODE_RADIUS: Record<GraphNode['type'], number> = {
  concept: 15,
  document: 18,
  reference: 12,
};

export function KnowledgeGraph({
  nodes,
  edges,
  activeDocId,
  theme,
  conceptsMap,
  docsMap,
  refsMap,
  onOpenDoc,
}: KnowledgeGraphProps) {
  const [mode, setMode] = useState<GraphMode>('full');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.92);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const nodeColors: Record<GraphNode['type'], string> =
    theme === 'light'
      ? { concept: '#9a3412', document: '#2d6a4f', reference: '#a16207' }
      : { concept: '#e07a3f', document: '#52b788', reference: '#e9b85b' };
  const labelColor = theme === 'light' ? 'rgba(61, 46, 37, 0.92)' : 'rgba(245, 245, 245, 0.92)';
  const edgeMuted = theme === 'light' ? 'rgba(61, 46, 37, 0.20)' : 'rgba(255, 255, 255, 0.17)';
  const edgeActive = theme === 'light' ? 'rgba(61, 46, 37, 0.65)' : 'rgba(255, 255, 255, 0.62)';

  const filtered = useMemo(() => {
    if (mode === 'concepts') {
      const cNodes = nodes.filter((n) => n.type === 'concept');
      const ids = new Set(cNodes.map((n) => n.id));
      const cEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      return { nodes: cNodes, edges: cEdges };
    }

    if (mode === 'local' && activeDocId) {
      const neighborIds = new Set<string>([activeDocId]);
      for (const e of edges) {
        if (e.source === activeDocId) neighborIds.add(e.target);
        if (e.target === activeDocId) neighborIds.add(e.source);
      }
      const lNodes = nodes.filter((n) => neighborIds.has(n.id));
      const lEdges = edges.filter((e) => neighborIds.has(e.source) && neighborIds.has(e.target));
      return { nodes: lNodes, edges: lEdges };
    }

    return { nodes, edges };
  }, [nodes, edges, mode, activeDocId]);

  const [simNodes, setSimNodes] = useState<SimNode[]>([]);

  // Spacious force-directed layout with collision separation so nodes & labels breathe
  useEffect(() => {
    const cx = 540;
    const cy = 360;
    const initial: SimNode[] = filtered.nodes.map((n, i) => {
      const angle = (i / Math.max(1, filtered.nodes.length)) * Math.PI * 2;
      const ring = n.type === 'document' ? 160 : n.type === 'concept' ? 290 : 410;
      return {
        ...n,
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
      };
    });

    const map = new Map(initial.map((n) => [n.id, n]));
    const minSeparation = 128;

    for (let step = 0; step < 180; step++) {
      // Strong repulsion + explicit minimum-distance collision push
      for (let i = 0; i < initial.length; i++) {
        for (let j = i + 1; j < initial.length; j++) {
          const a = initial[i];
          const b = initial[j];
          const dx = b.x - a.x || 0.1;
          const dy = b.y - a.y || 0.1;
          const distSq = dx * dx + dy * dy + 250;
          const dist = Math.sqrt(distSq);

          let force = 19000 / distSq;
          if (dist < minSeparation) {
            force += (minSeparation - dist) * 0.18;
          }

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Relaxed spring attraction along edges
      for (const e of filtered.edges) {
        const a = map.get(e.source);
        const b = map.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 230;
        const force = (dist - targetDist) * 0.028;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Very gentle centering + damping
      for (const n of initial) {
        n.vx = (n.vx + (cx - n.x) * 0.004) * 0.76;
        n.vy = (n.vy + (cy - n.y) * 0.004) * 0.76;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    setSimNodes(initial);
    setSelectedId(null);
    setZoom(0.92);
    setPan({ x: 0, y: 0 });
  }, [filtered]);

  const nodeMap = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  const focusId = hoveredId ?? selectedId;
  const connectedIds = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const e of filtered.edges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, filtered.edges]);

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (draggingNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setSimNodes((prev) =>
        prev.map((n) => (n.id === draggingNode ? { ...n, x, y } : n)),
      );
      return;
    }

    if (panning) {
      setPan({
        x: panning.origX + (e.clientX - panning.startX),
        y: panning.origY + (e.clientY - panning.startY),
      });
    }
  }

  function handlePointerUp() {
    setDraggingNode(null);
    setPanning(null);
  }

  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;

  // Compute Related Documents for whichever node is selected (1-to-many friendly!)
  const relatedDocuments = useMemo<IndexedDocument[]>(() => {
    if (!selectedNode) return [];
    const allDocs = Array.from(docsMap.values());

    if (selectedNode.type === 'concept') {
      return allDocs.filter(
        (d) =>
          d.concepts.includes(selectedNode.id) ||
          d.mentionedConcepts.includes(selectedNode.id),
      );
    }

    if (selectedNode.type === 'reference') {
      return allDocs.filter((d) => d.references.includes(selectedNode.id));
    }

    if (selectedNode.type === 'document') {
      const doc = docsMap.get(selectedNode.id);
      if (!doc) return [];
      const ids = Array.from(new Set([...doc.relatedDocs, ...doc.backlinks]));
      return ids
        .map((id) => docsMap.get(id))
        .filter((d): d is IndexedDocument => !!d);
    }

    return [];
  }, [selectedNode, docsMap]);

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <div className="graph-modes">
          <button
            className={`btn ${mode === 'full' ? 'btn-primary' : ''}`}
            onClick={() => setMode('full')}
          >
            Full Nexus
          </button>
          <button
            className={`btn ${mode === 'concepts' ? 'btn-primary' : ''}`}
            onClick={() => setMode('concepts')}
          >
            Concepts Only
          </button>
          <button
            className={`btn ${mode === 'local' ? 'btn-primary' : ''}`}
            disabled={!activeDocId}
            onClick={() => setMode('local')}
          >
            Local (Active Doc)
          </button>
        </div>

        <div className="graph-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: nodeColors.concept }} />
            Concept
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: nodeColors.document }} />
            Document
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: nodeColors.reference }} />
            Reference
          </span>

          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button
              className="btn"
              onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
            <button
              className="btn"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              className="btn"
              onClick={() => {
                setZoom(0.92);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset view"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="graph-canvas-wrap">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ cursor: panning ? 'grabbing' : 'grab', display: 'block' }}
          onPointerDown={(e) => {
            if ((e.target as Element).tagName === 'svg') {
              setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            setZoom((z) => Math.min(2.2, Math.max(0.4, z + delta)));
          }}
        >
          <defs>
            <marker
              id="arrow-muted"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={edgeMuted} />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={edgeActive} />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {filtered.edges.map((edge) => {
              const s = nodeMap.get(edge.source);
              const t = nodeMap.get(edge.target);
              if (!s || !t) return null;
              const isHighlighted =
                !focusId || edge.source === focusId || edge.target === focusId;
              const mx = (s.x + t.x) / 2;
              const my = (s.y + t.y) / 2;
              return (
                <g key={edge.id} opacity={isHighlighted ? 0.92 : 0.14}>
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={isHighlighted && focusId ? edgeActive : edgeMuted}
                    strokeWidth={isHighlighted && focusId ? 1.6 : 1.0}
                    strokeDasharray={
                      edge.type === 'mentions' || edge.type === 'relates_to' ? '4 4' : undefined
                    }
                    markerEnd={
                      isHighlighted && focusId ? 'url(#arrow-active)' : 'url(#arrow-muted)'
                    }
                  />
                  {focusId && isHighlighted && (
                    <text
                      x={mx}
                      y={my - 5}
                      textAnchor="middle"
                      fill={labelColor}
                      opacity={0.78}
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                    >
                      {edge.type}
                    </text>
                  )}
                </g>
              );
            })}

            {simNodes.map((node) => {
              const r = NODE_RADIUS[node.type];
              const color = nodeColors[node.type];
              const dimmed = connectedIds && !connectedIds.has(node.id);
              const isSelected = node.id === selectedId;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  opacity={dimmed ? 0.2 : 1}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingNode(node.id);
                    setSelectedId(node.id);
                  }}
                  onPointerEnter={() => setHoveredId(node.id)}
                  onPointerLeave={() => setHoveredId(null)}
                >
                  <circle
                    r={r + (isSelected ? 4 : 0)}
                    fill={color}
                    fillOpacity={0.14}
                    stroke={color}
                    strokeWidth={isSelected ? 2.2 : 1.4}
                  />
                  <circle r={3.5} fill={color} />
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    fill={labelColor}
                    fontSize="12"
                    fontWeight={isSelected ? 600 : 500}
                  >
                    {node.label.length > 26 ? `${node.label.slice(0, 24)}…` : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {selectedNode && (
          <div className="graph-detail-card">
            <span
              className={`cmd-type-tag ${selectedNode.type}`}
              style={{ alignSelf: 'flex-start' }}
            >
              {selectedNode.type}
            </span>
            <div style={{ fontSize: 15, fontWeight: 650 }}>{selectedNode.label}</div>
            {selectedNode.sublabel && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {selectedNode.sublabel}
              </div>
            )}

            {selectedNode.type === 'concept' && conceptsMap.get(selectedNode.id) && (
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                {conceptsMap.get(selectedNode.id)?.contexts['zh-Hant']}
              </div>
            )}

            {selectedNode.type === 'document' && docsMap.get(selectedNode.id) && (
              <>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                  {docsMap.get(selectedNode.id)?.summary}
                </div>
                <button
                  className="tree-row"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 9px',
                    marginTop: 2,
                  }}
                  onClick={() => onOpenDoc(selectedNode.id)}
                >
                  <FileText size={13} style={{ color: 'var(--doc-color)', flexShrink: 0 }} />
                  <span className="tree-row-label" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    Read “{selectedNode.label}”
                  </span>
                </button>
              </>
            )}

            {selectedNode.type === 'reference' && refsMap.get(selectedNode.id) && (
              <>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                  {refsMap.get(selectedNode.id)?.notes}
                </div>
                {refsMap.get(selectedNode.id)?.url && (
                  <a
                    className="btn"
                    href={refsMap.get(selectedNode.id)?.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
                  >
                    <ExternalLink size={12} />
                    Open Source
                  </a>
                )}
              </>
            )}

            {/* Related Documents list (handles 1-to-many Concept/Reference/Document links cleanly) */}
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                RELATED DOCUMENTS ({relatedDocuments.length})
              </div>
              {relatedDocuments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  No linked documents yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
                  {relatedDocuments.map((d) => (
                    <button
                      key={d.id}
                      className="tree-row"
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '6px 8px',
                      }}
                      onClick={() => onOpenDoc(d.id)}
                    >
                      <FileText size={13} style={{ color: 'var(--doc-color)', flexShrink: 0 }} />
                      <span className="tree-row-label" style={{ color: 'var(--text-primary)' }}>
                        {d.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
