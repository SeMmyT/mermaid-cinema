// src/animation/prepare-svg.ts
import { JSDOM } from "jsdom"
import type { DiagramInfo, EdgeInfo, NodeInfo } from "../inspect.js"

export interface AnimatableNode {
  id: string
  label: string
  /** CSS selector to target this node group in the SVG */
  selector: string
}

export interface AnimatableEdge {
  id: string
  source: string
  target: string
  /** CSS selector for the edge path */
  pathSelector: string
  /** SVG path `d` attribute value */
  pathD: string
  /** CSS selector for the edge label (if any) */
  labelSelector: string | null
}

export interface PreparedSvg {
  /** The SVG string with data-mc-* attributes injected for animation targeting */
  svg: string
  nodes: AnimatableNode[]
  edges: AnimatableEdge[]
  /** Topological order of element IDs (nodes + edges interleaved) */
  revealOrder: string[]
}

/**
 * Parse the Mermaid SVG and extract animatable elements.
 * Injects `data-mc-id` attributes for reliable CSS targeting from React components.
 */
export function prepareSvgForAnimation(
  svgStr: string,
  info: DiagramInfo,
): PreparedSvg {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>${svgStr}</body></html>`,
    { contentType: "text/html" },
  )
  const document = dom.window.document
  const svgEl = document.querySelector("svg")
  if (!svgEl) throw new Error("No SVG element found")

  const nodes: AnimatableNode[] = []
  const edges: AnimatableEdge[] = []

  // Tag node elements with data-mc-id
  const nodeEls = document.querySelectorAll(".node")
  for (const el of Array.from(nodeEls)) {
    const origId =
      el.getAttribute("id") ?? el.getAttribute("data-id") ?? ""
    if (!origId) continue

    const mcId = `mc-node-${origId}`
    el.setAttribute("data-mc-id", mcId)

    const labelEl =
      el.querySelector(".nodeLabel") ?? el.querySelector("text")
    const label = labelEl?.textContent?.trim() ?? origId

    nodes.push({
      id: mcId,
      label,
      selector: `[data-mc-id="${mcId}"]`,
    })
  }

  // Tag edge elements and extract path data
  const edgeContainers = document.querySelectorAll(
    ".edgePath, .flowchart-link, [data-edge]",
  )
  const seen = new Set<string>()
  for (const el of Array.from(edgeContainers)) {
    const origId =
      el.getAttribute("data-id") ?? el.getAttribute("id") ?? ""
    if (!origId || seen.has(origId)) continue
    seen.add(origId)

    const mcId = `mc-edge-${origId}`
    el.setAttribute("data-mc-id", mcId)

    const pathEl = el.querySelector("path")
    const pathD = pathEl?.getAttribute("d") ?? ""

    // Find matching edge from inspect info
    const edgeInfo = info.edges.find((e) => e.id === origId)
    const source = edgeInfo?.source ?? ""
    const target = edgeInfo?.target ?? ""

    // Check for edge label
    const labelEl = el.querySelector(".edgeLabel")
    const labelMcId = labelEl ? `mc-edgelabel-${origId}` : null
    if (labelEl && labelMcId) {
      labelEl.setAttribute("data-mc-id", labelMcId)
    }

    edges.push({
      id: mcId,
      source,
      target,
      pathSelector: `[data-mc-id="${mcId}"] path`,
      pathD,
      labelSelector: labelMcId ? `[data-mc-id="${labelMcId}"]` : null,
    })
  }

  // Also tag standalone edgeLabels not inside edgePath containers
  const standaloneLabels = document.querySelectorAll(
    ".edgeLabel:not([data-mc-id])",
  )
  for (const el of Array.from(standaloneLabels)) {
    const parentId =
      el.getAttribute("id") ?? el.getAttribute("data-id") ?? ""
    if (parentId) {
      el.setAttribute("data-mc-id", `mc-edgelabel-${parentId}`)
    }
  }

  // Build topological reveal order:
  // For each edge, ensure source node appears before the edge, edge before target node
  const revealOrder = buildRevealOrder(nodes, edges, info)

  const updatedSvg = svgEl.outerHTML
  return { svg: updatedSvg, nodes, edges, revealOrder }
}

/**
 * Build a topological reveal order: nodes appear before their outgoing edges,
 * edges appear before target nodes.
 */
function buildRevealOrder(
  nodes: AnimatableNode[],
  edges: AnimatableEdge[],
  info: DiagramInfo,
): string[] {
  // Map from original node IDs to mc IDs
  const nodeByOrigId = new Map<string, string>()
  for (const n of nodes) {
    // mc-node-{origId} -> extract origId
    const origId = n.id.replace("mc-node-", "")
    nodeByOrigId.set(origId, n.id)
  }

  // Simple topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  // Initialize all nodes
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adjList.set(n.id, [])
  }
  for (const e of edges) {
    inDegree.set(e.id, 0)
    adjList.set(e.id, [])
  }

  // source_node -> edge -> target_node
  for (const e of edges) {
    const sourceMcId = nodeByOrigId.get(e.source)
    const targetMcId = nodeByOrigId.get(e.target)

    if (sourceMcId) {
      adjList.get(sourceMcId)?.push(e.id)
      inDegree.set(e.id, (inDegree.get(e.id) ?? 0) + 1)
    }
    if (targetMcId) {
      adjList.get(e.id)?.push(targetMcId)
      inDegree.set(targetMcId, (inDegree.get(targetMcId) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    for (const next of adjList.get(current) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  // Add any remaining elements that weren't in the graph (disconnected nodes)
  const inOrder = new Set(order)
  for (const n of nodes) {
    if (!inOrder.has(n.id)) order.push(n.id)
  }
  for (const e of edges) {
    if (!inOrder.has(e.id)) order.push(e.id)
  }

  return order
}
