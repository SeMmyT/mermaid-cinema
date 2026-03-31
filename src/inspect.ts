// src/inspect.ts
import { JSDOM } from "jsdom"

export interface NodeInfo {
  id: string
  label: string
  cssClass: string
}

export interface EdgeInfo {
  id: string
  source: string
  target: string
}

export interface DiagramInfo {
  nodes: NodeInfo[]
  edges: EdgeInfo[]
  diagramType: string
  svgWidth: string
  svgHeight: string
}

export function inspectSvg(svg: string): DiagramInfo {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${svg}</body></html>`, {
    contentType: "text/html",
  })
  const document = dom.window.document

  const svgEl = document.querySelector("svg")
  const svgWidth = svgEl?.getAttribute("width") ?? "unknown"
  const svgHeight = svgEl?.getAttribute("height") ?? "unknown"

  // Detect diagram type from SVG attributes or class
  const ariaLabel = svgEl?.getAttribute("aria-roledescription") ?? ""
  const diagramType = ariaLabel || "unknown"

  // Extract nodes — Mermaid uses .node class for flowchart nodes
  const nodeEls = document.querySelectorAll(".node")
  const nodes: NodeInfo[] = Array.from(nodeEls).map((el) => {
    const id = el.getAttribute("id") ?? el.getAttribute("data-id") ?? ""
    const labelEl = el.querySelector(".nodeLabel") ?? el.querySelector("text")
    const label = labelEl?.textContent?.trim() ?? ""
    const cssClass = el.getAttribute("class") ?? ""
    return { id, label, cssClass }
  })

  // Extract edges — Mermaid v11 uses [data-edge] or .flowchart-link
  const edgeEls = document.querySelectorAll("[data-edge], .flowchart-link, .edgePath")
  const seen = new Set<string>()
  const edges: EdgeInfo[] = []
  for (const el of Array.from(edgeEls)) {
    const id = el.getAttribute("data-id") ?? el.getAttribute("id") ?? ""
    if (!id || seen.has(id)) continue
    seen.add(id)
    // Edge IDs follow pattern: L_A_B_0 or L-A-B
    const match = id.match(/^L[-_](.+?)[-_](.+?)(?:[-_]\d+)?$/)
    const source = match?.[1] ?? ""
    const target = match?.[2] ?? ""
    edges.push({ id, source, target })
  }

  return { nodes, edges, diagramType, svgWidth, svgHeight }
}
