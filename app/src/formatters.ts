import type { GraphEdgeType } from '../server/types';

const RELATION_LABELS: Record<GraphEdgeType, string> = {
  is_a: 'is a',
  part_of: 'part of',
  generalizes: 'generalizes',
  example_of: 'example of',
  depends_on: 'depends on',
  enables: 'enables',
  solves: 'solves',
  used_in: 'used in',
  influences: 'influences',
  contrasts_with: 'contrasts with',
  relates_to: 'relates to',
  explains: 'explains',
  mentions: 'mentions',
  links_to: 'links to',
  cites: 'cites',
};

export function formatRelationLabel(type: GraphEdgeType | string): string {
  return RELATION_LABELS[type as GraphEdgeType] ?? type.replace(/_/g, ' ');
}
