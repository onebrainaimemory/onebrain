'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './entity-graph.module.css';

interface EntityLink {
  id: string;
  memoryItemId: string;
  linkType: string;
  createdAt: string;
}

interface GraphEntity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  links: EntityLink[];
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  description: string | null;
  linkCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  sourceId: string;
  targetId: string;
  memoryItemId: string;
}

const TYPE_COLORS: Record<string, string> = {
  person: '#3b82f6',
  organization: '#ec4899',
  place: '#10b981',
  concept: '#f59e0b',
  tool: '#8b5cf6',
};

function getNodeRadius(linkCount: number): number {
  return Math.min(30, Math.max(12, 10 + linkCount * 3));
}

function buildGraph(entities: GraphEntity[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  const centerX = 400;
  const centerY = 300;

  for (let idx = 0; idx < entities.length; idx++) {
    const entity = entities[idx]!;
    const angle = (2 * Math.PI * idx) / entities.length;
    const radius = 180 + Math.random() * 60;

    nodes.push({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      linkCount: entity.links.length,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    });

    for (const link of entity.links) {
      for (const other of entities) {
        if (other.id === entity.id) continue;

        const hasSharedMemory = other.links.some(
          (otherLink) => otherLink.memoryItemId === link.memoryItemId,
        );

        if (hasSharedMemory) {
          const edgeKey = [entity.id, other.id].sort().join(':');

          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              sourceId: entity.id,
              targetId: other.id,
              memoryItemId: link.memoryItemId,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}

function applyForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphNode[] {
  const updated = nodes.map((n) => ({ ...n }));
  const repulsion = 3000;
  const attraction = 0.01;
  const damping = 0.85;
  const centerForce = 0.005;

  // Repulsion between all pairs
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const nodeA = updated[i]!;
      const nodeB = updated[j]!;
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      nodeA.vx += fx;
      nodeA.vy += fy;
      nodeB.vx -= fx;
      nodeB.vy -= fy;
    }
  }

  // Attraction along edges
  const nodeMap = new Map(updated.map((n) => [n.id, n]));
  for (const edge of edges) {
    const source = nodeMap.get(edge.sourceId);
    const target = nodeMap.get(edge.targetId);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const fx = dx * attraction;
    const fy = dy * attraction;

    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  // Center gravity + apply velocity
  const cx = width / 2;
  const cy = height / 2;

  for (const node of updated) {
    node.vx += (cx - node.x) * centerForce;
    node.vy += (cy - node.y) * centerForce;
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx;
    node.y += node.vy;

    // Keep within bounds
    const r = getNodeRadius(node.linkCount);
    node.x = Math.max(r, Math.min(width - r, node.x));
    node.y = Math.max(r, Math.min(height - r, node.y));
  }

  return updated;
}

interface EntityGraphProps {
  entities: GraphEntity[];
  t: (key: string) => string;
}

export function EntityGraph({ entities, t }: EntityGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  } | null>(null);

  const width = 800;
  const height = 600;

  useEffect(() => {
    if (entities.length === 0) return;

    // eslint-disable-next-line prefer-const
    let { nodes, edges } = buildGraph(entities);

    // Run simulation for 60 iterations
    for (let iter = 0; iter < 60; iter++) {
      nodes = applyForceSimulation(nodes, edges, width, height);
    }

    setGraphData({ nodes, edges });
  }, [entities]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  if (entities.length === 0) {
    return <p className={styles.graphEmpty}>{t('entities.graph_empty')}</p>;
  }

  if (!graphData) {
    return <p className={styles.graphEmpty}>{t('common.loading')}</p>;
  }

  const { nodes, edges } = graphData;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;

  return (
    <div className={styles.graphContainer}>
      <div className={styles.graphWrapper}>
        <svg
          ref={svgRef}
          className={styles.graphSvg}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Edges */}
          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.sourceId);
            const target = nodeMap.get(edge.targetId);
            if (!source || !target) return null;

            const isHighlighted = selectedId === edge.sourceId || selectedId === edge.targetId;

            return (
              <line
                key={`edge-${idx}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={isHighlighted ? styles.edgeHighlighted : styles.edge}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const radius = getNodeRadius(node.linkCount);
            const color = TYPE_COLORS[node.type] ?? '#6b7280';
            const isSelected = selectedId === node.id;
            const isConnected =
              selectedId !== null &&
              edges.some(
                (e) =>
                  (e.sourceId === selectedId && e.targetId === node.id) ||
                  (e.targetId === selectedId && e.sourceId === node.id),
              );
            const isDimmed = selectedId !== null && !isSelected && !isConnected;

            return (
              <g
                key={node.id}
                className={styles.nodeGroup}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  opacity={isDimmed ? 0.3 : 1}
                  stroke={isSelected ? '#fff' : 'none'}
                  strokeWidth={isSelected ? 3 : 0}
                />
                <text
                  x={node.x}
                  y={node.y + radius + 14}
                  textAnchor="middle"
                  className={styles.nodeLabel}
                  opacity={isDimmed ? 0.3 : 1}
                >
                  {node.name.length > 18 ? node.name.slice(0, 16) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className={styles.detailsSidebar}>
          <div className={styles.detailsHeader}>
            <h3 className={styles.detailsName}>{selectedNode.name}</h3>
            <span
              className={styles.detailsType}
              style={{
                backgroundColor: TYPE_COLORS[selectedNode.type] ?? '#6b7280',
              }}
            >
              {selectedNode.type}
            </span>
          </div>
          {selectedNode.description && (
            <p className={styles.detailsDesc}>{selectedNode.description}</p>
          )}
          <p className={styles.detailsLinks}>
            {selectedNode.linkCount} {t('entities.linked_memories')}
          </p>
          <button className={styles.detailsClose} onClick={() => setSelectedId(null)}>
            {t('common.close')}
          </button>
        </div>
      )}

      <p className={styles.graphHint}>{t('entities.graph_click_hint')}</p>
    </div>
  );
}
