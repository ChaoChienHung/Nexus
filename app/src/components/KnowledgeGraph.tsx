import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  formatRelationLabel,
  getConceptContext,
  getConceptLabel,
  UI_COPY,
  type UiLang,
} from '../i18n';
import type {
  ConceptRankedDoc,
  GraphEdge,
  GraphEdgeType,
  GraphNode,
  IndexedDocument,
  OntologyConcept,
} from '../../server/types';

type GraphMode = 'full' | 'concepts' | 'local';

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeDocId: string | null;
  theme: 'light' | 'dark';
  lang: UiLang;
  conceptsMap: Map<string, OntologyConcept>;
  conceptTopDocs: Record<string, ConceptRankedDoc[]>;
  docsMap: Map<string, IndexedDocument>;
  onOpenDoc: (docId: string) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

type EdgeFamily = 'hierarchy' | 'causal' | 'contrast' | 'association' | 'explains' | 'mentions' | 'doc_link';

interface VisualEdge extends GraphEdge {
  family: EdgeFamily;
  bidirectional: boolean;
}

interface EdgeStyleSpec {
  color: string;
  strokeWidth: number;
  dash?: string;
  arrow: 'none' | 'single' | 'double';
}

const NODE_RADIUS: Record<GraphNode['type'], number> = {
  concept: 15,
  document: 18,
};

function getEdgeFamily(type: GraphEdgeType): EdgeFamily {
  switch (type) {
    case 'is_a':
    case 'part_of':
    case 'generalizes':
    case 'example_of':
      return 'hierarchy';
    case 'depends_on':
    case 'enables':
    case 'solves':
    case 'used_in':
    case 'influences':
      return 'causal';
    case 'contrasts_with':
      return 'contrast';
    case 'relates_to':
      return 'association';
    case 'explains':
      return 'explains';
    case 'mentions':
      return 'mentions';
    case 'links_to':
      return 'doc_link';
  }
}

function getEdgePalette(theme: 'light' | 'dark'): Record<EdgeFamily, EdgeStyleSpec> {
  const isLight = theme === 'light';
  return {
    hierarchy: {
      color: isLight ? '#3b5998' : '#7ea6e0',
      strokeWidth: 2.3,
      arrow: 'single',
    },
    causal: {
      color: isLight ? '#8f4b23' : '#e58a6c',
      strokeWidth: 1.8,
      dash: '7 4',
      arrow: 'single',
    },
    contrast: {
      color: isLight ? '#9d2b48' : '#e27894',
      strokeWidth: 1.7,
      dash: '5 4',
      arrow: 'double',
    },
    association: {
      color: isLight ? '#78716c' : '#9c968e',
      strokeWidth: 1.4,
      dash: '2 4',
      arrow: 'none',
    },
    explains: {
      color: isLight ? '#2f6b55' : '#7cc4a5',
      strokeWidth: 2.1,
      arrow: 'single',
    },
    mentions: {
      color: isLight ? '#2f6b55' : '#7cc4a5',
      strokeWidth: 1.3,
      dash: '2 4',
      arrow: 'none',
    },
    doc_link: {
      color: isLight ? '#8a5a12' : '#e2b45e',
      strokeWidth: 1.7,
      arrow: 'single',
    },
  };
}

export function KnowledgeGraph({
  nodes,
  edges,
  activeDocId,
  theme,
  lang,
  conceptsMap,
  conceptTopDocs,
  docsMap,
  onOpenDoc,
}: KnowledgeGraphProps) {
  const t = UI_COPY[lang];
  const [mode, setMode] = useState<GraphMode>('full');
  const [categoryScope, setCategoryScope] = useState<string>('all');
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
    moved: boolean;
  } | null>(null);

  // Press Escape to deselect active node
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);

  const nodeColors: Record<GraphNode['type'], string> =
    theme === 'light'
      ? { concept: '#8f4b23', document: '#3d6b52' }
      : { concept: '#e58a6c', document: '#7cc4a5' };
  const labelColor = theme === 'light' ? '#3b2a1e' : '#d9d6cf';
  const edgePalette = useMemo(() => getEdgePalette(theme), [theme]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const d of docsMap.values()) {
      if (d.categoryPath[0]) set.add(d.categoryPath[0]);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [docsMap]);

  const filtered = useMemo(() => {
    let baseNodes = nodes;
    let baseEdges = edges;

    if (categoryScope !== 'all') {
      const scopedDocIds = new Set<string>();
      const scopedConceptIds = new Set<string>();
      for (const d of docsMap.values()) {
        if (d.categoryPath[0] === categoryScope) {
          scopedDocIds.add(d.id);
          for (const cid of d.concepts) scopedConceptIds.add(cid);
          for (const cid of d.mentionedConcepts) scopedConceptIds.add(cid);
        }
      }
      baseNodes = nodes.filter((n) =>
        n.type === 'document' ? scopedDocIds.has(n.id) : scopedConceptIds.has(n.id),
      );
      const allowedIds = new Set(baseNodes.map((n) => n.id));
      baseEdges = edges.filter((e) => allowedIds.has(e.source) && allowedIds.has(e.target));
    }

    if (mode === 'concepts') {
      const cNodes = baseNodes.filter((n) => n.type === 'concept');
      const ids = new Set(cNodes.map((n) => n.id));
      const cEdges = baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
      return { nodes: cNodes, edges: cEdges };
    }

    if (mode === 'local' && activeDocId) {
      const neighborIds = new Set<string>([activeDocId]);
      for (const e of baseEdges) {
        if (e.source === activeDocId) neighborIds.add(e.target);
        if (e.target === activeDocId) neighborIds.add(e.source);
      }
      const lNodes = baseNodes.filter((n) => neighborIds.has(n.id));
      const lEdges = baseEdges.filter((e) => neighborIds.has(e.source) && neighborIds.has(e.target));
      return { nodes: lNodes, edges: lEdges };
    }

    return { nodes: baseNodes, edges: baseEdges };
  }, [nodes, edges, mode, activeDocId, categoryScope, docsMap]);

  // Merge symmetric pairs (e.g., mutual contrasts_with, relates_to, links_to) into clean single bidirectional edges
  const visualEdges = useMemo<VisualEdge[]>(() => {
    const out: VisualEdge[] = [];
    const seenUndirected = new Map<string, VisualEdge>();

    for (const edge of filtered.edges) {
      const family = getEdgeFamily(edge.type);
      const isSymmetricType =
        edge.type === 'contrasts_with' ||
        edge.type === 'relates_to' ||
        edge.type === 'links_to';

      if (isSymmetricType) {
        const pairKey = [edge.source, edge.target].sort().join('||') + `|${edge.type}`;
        const existing = seenUndirected.get(pairKey);
        if (existing) {
          existing.bidirectional = true;
          continue;
        }
        const ve: VisualEdge = {
          ...edge,
          family,
          bidirectional: edge.type === 'contrasts_with',
        };
        seenUndirected.set(pairKey, ve);
        out.push(ve);
      } else {
        out.push({ ...edge, family, bidirectional: false });
      }
    }

    return out;
  }, [filtered.edges]);

  const [simNodes, setSimNodes] = useState<SimNode[]>([]);

  // Spacious force-directed layout with collision separation so nodes & labels breathe
  useEffect(() => {
    const cx = 520;
    const cy = 350;
    const initial: SimNode[] = filtered.nodes.map((n, i) => {
      const angle = (i / Math.max(1, filtered.nodes.length)) * Math.PI * 2;
      const ring = n.type === 'document' ? 170 : 300;
      return {
        ...n,
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
      };
    });

    const map = new Map(initial.map((n) => [n.id, n]));
    const minSeparation = 134;

    for (let step = 0; step < 180; step++) {
      for (let i = 0; i < initial.length; i++) {
        for (let j = i + 1; j < initial.length; j++) {
          const a = initial[i];
          const b = initial[j];
          const dx = b.x - a.x || 0.1;
          const dy = b.y - a.y || 0.1;
          const distSq = dx * dx + dy * dy + 250;
          const dist = Math.sqrt(distSq);

          let force = 19500 / distSq;
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

      for (const e of filtered.edges) {
        const a = map.get(e.source);
        const b = map.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 235;
        const force = (dist - targetDist) * 0.028;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

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
    for (const e of visualEdges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, visualEdges]);

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
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      if (!panning.moved && Math.hypot(dx, dy) > 4) {
        setPanning({ ...panning, moved: true });
      }
      setPan({
        x: panning.origX + dx,
        y: panning.origY + dy,
      });
    }
  }

  function handlePointerUp() {
    if (panning && !panning.moved) {
      setSelectedId(null);
    }
    setDraggingNode(null);
    setPanning(null);
  }

  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;

  const relatedDocuments = useMemo<IndexedDocument[]>(() => {
    if (!selectedNode) return [];

    if (selectedNode.type === 'concept') {
      return (conceptTopDocs[selectedNode.id] ?? [])
        .map((r) => docsMap.get(r.docId))
        .filter((d): d is IndexedDocument => !!d);
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
  }, [selectedNode, conceptTopDocs, docsMap]);

  const edgeFamilies: EdgeFamily[] = [
    'hierarchy',
    'causal',
    'contrast',
    'association',
    'explains',
    'mentions',
    'doc_link',
  ];

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <div className="graph-modes">
          <button
            className={`graph-mode-btn ${mode === 'full' ? 'active' : ''}`}
            onClick={() => setMode('full')}
          >
            {t.fullNexus}
          </button>
          <button
            className={`graph-mode-btn ${mode === 'concepts' ? 'active' : ''}`}
            onClick={() => setMode('concepts')}
          >
            {t.conceptsOnly}
          </button>
          <button
            className={`graph-mode-btn ${mode === 'local' ? 'active' : ''}`}
            disabled={!activeDocId}
            onClick={() => setMode('local')}
          >
            {t.localGraph}
          </button>
          {categories.length > 1 && (
            <select
              className="graph-scope-select"
              value={categoryScope}
              onChange={(e) => setCategoryScope(e.target.value)}
              aria-label="Category scope"
            >
              <option value="all">{t.scopeAllCategories}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="graph-zoom-btn"
            onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
            title="Zoom in"
          >
            <ZoomIn size={19} />
          </button>
          <button
            className="graph-zoom-btn"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            title="Zoom out"
          >
            <ZoomOut size={19} />
          </button>
          <button
            className="graph-zoom-btn"
            onClick={() => {
              setZoom(0.92);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset view"
          >
            <Maximize2 size={19} />
          </button>
        </div>
      </div>

      <div className="graph-canvas-wrap">
        <div className="graph-legend-floating">
          <span className="legend-title">{t.legendNodes}</span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: nodeColors.concept }} />
            {t.conceptNode}
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: nodeColors.document }} />
            {t.documentNode}
          </span>

          <div className="legend-divider" />
          <span className="legend-title">{t.legendRelations}</span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="1" y1="5" x2="21" y2="5" stroke={edgePalette.hierarchy.color} strokeWidth="2.3" />
              <polygon points="20,2 27,5 20,8" fill={edgePalette.hierarchy.color} />
            </svg>
            <span>{t.edgeHierarchy}</span>
          </span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="1" y1="5" x2="21" y2="5" stroke={edgePalette.causal.color} strokeWidth="1.8" strokeDasharray="5 3" />
              <polygon points="20,2 27,5 20,8" fill={edgePalette.causal.color} />
            </svg>
            <span>{t.edgeCausal}</span>
          </span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <polygon points="8,2 1,5 8,8" fill={edgePalette.contrast.color} />
              <line x1="7" y1="5" x2="21" y2="5" stroke={edgePalette.contrast.color} strokeWidth="1.7" strokeDasharray="4 3" />
              <polygon points="20,2 27,5 20,8" fill={edgePalette.contrast.color} />
            </svg>
            <span>{t.edgeContrast}</span>
          </span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="1" y1="5" x2="27" y2="5" stroke={edgePalette.association.color} strokeWidth="1.5" strokeDasharray="2 4" />
            </svg>
            <span>{t.edgeAssociation}</span>
          </span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <line x1="1" y1="5" x2="21" y2="5" stroke={edgePalette.explains.color} strokeWidth="2.1" />
              <polygon points="20,2 27,5 20,8" fill={edgePalette.explains.color} />
            </svg>
            <span>{t.edgeExplains}</span>
          </span>

          <span className="legend-edge-row">
            <svg width="28" height="10" viewBox="0 0 28 10">
              <polygon points="8,2 1,5 8,8" fill={edgePalette.doc_link.color} />
              <line x1="7" y1="5" x2="21" y2="5" stroke={edgePalette.doc_link.color} strokeWidth="1.7" />
              <polygon points="20,2 27,5 20,8" fill={edgePalette.doc_link.color} />
            </svg>
            <span>{t.edgeDocLink}</span>
          </span>
        </div>

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ cursor: panning ? 'grabbing' : 'grab', display: 'block' }}
          onPointerDown={(e) => {
            if ((e.target as Element).tagName === 'svg') {
              setPanning({
                startX: e.clientX,
                startY: e.clientY,
                origX: pan.x,
                origY: pan.y,
                moved: false,
              });
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
            {edgeFamilies.map((fam) => {
              const color = edgePalette[fam].color;
              return (
                <marker
                  key={fam}
                  id={`arrow-${fam}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 10 5 L 0 8.8 z" fill={color} />
                </marker>
              );
            })}
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {visualEdges.map((edge) => {
              const s = nodeMap.get(edge.source);
              const targetNode = nodeMap.get(edge.target);
              if (!s || !targetNode) return null;

              const dx = targetNode.x - s.x;
              const dy = targetNode.y - s.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;

              const rSource = NODE_RADIUS[s.type] + 4;
              const rTarget = NODE_RADIUS[targetNode.type] + 4;
              const x1 = s.x + ux * rSource;
              const y1 = s.y + uy * rSource;
              const x2 = targetNode.x - ux * rTarget;
              const y2 = targetNode.y - uy * rTarget;

              const spec = edgePalette[edge.family];
              const isHighlighted =
                !focusId || edge.source === focusId || edge.target === focusId;
              const useDoubleArrow =
                spec.arrow !== 'none' && (spec.arrow === 'double' || edge.bidirectional);
              const useSingleArrow = spec.arrow === 'single' && !useDoubleArrow;

              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;

              return (
                <g key={edge.id} opacity={isHighlighted ? (focusId ? 0.96 : 0.72) : 0.12}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={spec.color}
                    strokeWidth={isHighlighted && focusId ? spec.strokeWidth + 0.5 : spec.strokeWidth}
                    strokeDasharray={spec.dash}
                    strokeLinecap="round"
                    markerEnd={
                      useSingleArrow || useDoubleArrow ? `url(#arrow-${edge.family})` : undefined
                    }
                    markerStart={
                      useDoubleArrow ? `url(#arrow-${edge.family})` : undefined
                    }
                  />
                  {focusId && isHighlighted && (
                    <text
                      x={mx}
                      y={my - 4}
                      textAnchor="middle"
                      fill={spec.color}
                      stroke="var(--bg-page)"
                      strokeWidth={4}
                      paintOrder="stroke"
                      fontSize="12"
                      fontWeight={550}
                    >
                      {formatRelationLabel(edge.type, lang)}
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
              const displayLabel =
                node.type === 'concept' && conceptsMap.get(node.id)
                  ? getConceptLabel(conceptsMap.get(node.id)!, lang)
                  : node.label;
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
                    strokeWidth={isSelected ? 2.4 : 1.5}
                  />
                  <circle r={3.8} fill={color} />
                  <text
                    y={r + 19}
                    textAnchor="middle"
                    fill={labelColor}
                    fontSize="14"
                    fontWeight={isSelected ? 600 : 500}
                  >
                    {displayLabel.length > 26 ? `${displayLabel.slice(0, 24)}…` : displayLabel}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {selectedNode && (
          <div className="graph-detail-card">
            <span className="detail-type">
              {selectedNode.type === 'concept' ? t.conceptNode : t.documentNode}
            </span>
            <div className="detail-title">
              {selectedNode.type === 'concept' && conceptsMap.get(selectedNode.id)
                ? getConceptLabel(conceptsMap.get(selectedNode.id)!, lang)
                : selectedNode.label}
            </div>

            {selectedNode.type === 'concept' && conceptsMap.get(selectedNode.id) && (
              <div className="detail-body">
                {getConceptContext(conceptsMap.get(selectedNode.id)!, lang)}
              </div>
            )}

            {selectedNode.type === 'document' && docsMap.get(selectedNode.id) && (
              <>
                <div className="detail-body">{docsMap.get(selectedNode.id)?.summary}</div>
                <button
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: 12 }}
                  onClick={() => onOpenDoc(selectedNode.id)}
                >
                  {t.readDoc(selectedNode.label)}
                </button>
              </>
            )}

            <div className="panel-section" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="panel-heading">
                {selectedNode.type === 'concept' ? t.topRelatedDocuments : t.relatedDocuments}
              </div>
              {relatedDocuments.length === 0 ? (
                <div className="detail-body" style={{ color: 'var(--text-muted)' }}>{t.noLinkedDocs}</div>
              ) : (
                relatedDocuments.map((d) => (
                  <button key={d.id} className="list-row" onClick={() => onOpenDoc(d.id)}>
                    <span className="list-row-label">{d.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
