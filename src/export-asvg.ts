// src/export-asvg.ts — Animated SVG (SMIL) exporter
// Zero-dependency animation path: no Remotion, no Chromium.
import { JSDOM } from "jsdom"
import type { DiagramInfo } from "./inspect.js"
import type { ResolvedStep, StepsConfig } from "./steps/parse-steps.js"

export interface AsvgOptions {
  svg: string
  diagram: DiagramInfo
  config: StepsConfig
  resolvedSteps: ResolvedStep[]
}

/**
 * Inject SMIL animations into a Mermaid SVG based on steps config.
 * Returns a standalone animated SVG string.
 */
export function exportAnimatedSvg(opts: AsvgOptions): string {
  const { svg, diagram, config, resolvedSteps } = opts

  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>${svg}</body></html>`,
    { contentType: "text/html" },
  )
  const document = dom.window.document
  const svgEl = document.querySelector("svg")
  if (!svgEl) throw new Error("No SVG element found")

  // Build node element lookup: nodeId -> DOM element
  const nodeElMap = new Map<string, Element>()
  const nodeEls = document.querySelectorAll(".node")
  for (const el of Array.from(nodeEls)) {
    const id = el.getAttribute("id") ?? el.getAttribute("data-id") ?? ""
    if (id) nodeElMap.set(id, el)
  }

  // Build edge element lookup: edgeId -> DOM element (with path child)
  const edgeElMap = new Map<string, Element>()
  const edgeEls = document.querySelectorAll(
    ".edgePath, .flowchart-link, [data-edge]",
  )
  const seenEdges = new Set<string>()
  for (const el of Array.from(edgeEls)) {
    const id = el.getAttribute("data-id") ?? el.getAttribute("id") ?? ""
    if (id && !seenEdges.has(id)) {
      seenEdges.add(id)
      edgeElMap.set(id, el)
    }
  }

  // Calculate timing
  const stepCount = resolvedSteps.length
  const totalDuration =
    config.duration === "auto"
      ? 1 + stepCount * 2 // 2s per step + 1s buffer
      : config.duration
  const stepDuration = totalDuration / stepCount
  const transitionDuration = Math.min(stepDuration * 0.6, 0.8)

  // Initially hide all nodes and edges
  for (const [, el] of nodeElMap) {
    el.setAttribute("opacity", "0")
    el.setAttribute("transform-origin", "center center")
  }
  for (const [, el] of edgeElMap) {
    const pathEl = el.querySelector("path")
    if (pathEl) {
      // Calculate approximate path length for dashoffset
      const pathD = pathEl.getAttribute("d") ?? ""
      const approxLen = estimatePathLength(pathD)
      pathEl.setAttribute("stroke-dasharray", String(approxLen))
      pathEl.setAttribute("stroke-dashoffset", String(approxLen))
    }
  }

  // Create a defs element for shared resources
  let defsEl = svgEl.querySelector("defs")
  if (!defsEl) {
    defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    svgEl.prepend(defsEl)
  }

  // Track cumulative visibility
  const visibleNodes = new Set<string>()
  const visibleEdges = new Set<string>()

  // Inject SMIL animations for each step
  for (let i = 0; i < resolvedSteps.length; i++) {
    const step = resolvedSteps[i]
    const begin = `${(i * stepDuration).toFixed(2)}s`

    // Show nodes: opacity 0→1
    for (const nodeId of step.showNodeIds) {
      if (visibleNodes.has(nodeId)) continue
      visibleNodes.add(nodeId)

      const el = nodeElMap.get(nodeId)
      if (!el) continue

      const anim = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
      )
      anim.setAttribute("attributeName", "opacity")
      anim.setAttribute("from", "0")
      anim.setAttribute("to", "1")
      anim.setAttribute("begin", begin)
      anim.setAttribute("dur", `${transitionDuration.toFixed(2)}s`)
      anim.setAttribute("fill", "freeze")
      el.appendChild(anim)
    }

    // Connect edges: stroke-dashoffset → 0
    for (const edgeRef of step.connectEdges) {
      if (visibleEdges.has(edgeRef.edgeId)) continue
      visibleEdges.add(edgeRef.edgeId)

      const el = edgeElMap.get(edgeRef.edgeId)
      if (!el) continue

      const pathEl = el.querySelector("path")
      if (!pathEl) continue

      const pathD = pathEl.getAttribute("d") ?? ""
      const approxLen = estimatePathLength(pathD)

      const anim = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
      )
      anim.setAttribute("attributeName", "stroke-dashoffset")
      anim.setAttribute("from", String(approxLen))
      anim.setAttribute("to", "0")
      anim.setAttribute("begin", begin)
      anim.setAttribute("dur", `${transitionDuration.toFixed(2)}s`)
      anim.setAttribute("fill", "freeze")
      pathEl.appendChild(anim)
    }

    // Highlight nodes: pulse scale via animateTransform
    for (const nodeId of step.highlightNodeIds) {
      const el = nodeElMap.get(nodeId)
      if (!el) continue

      const pulse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animateTransform",
      )
      pulse.setAttribute("attributeName", "transform")
      pulse.setAttribute("type", "scale")
      pulse.setAttribute("values", "1;1.05;1")
      pulse.setAttribute("begin", begin)
      pulse.setAttribute("dur", `${(stepDuration * 0.8).toFixed(2)}s`)
      pulse.setAttribute("fill", "freeze")
      pulse.setAttribute("additive", "sum")
      el.appendChild(pulse)
    }

    // Label text — add as a text element at the bottom
    if (step.label) {
      const labelBegin = `${(i * stepDuration).toFixed(2)}s`
      const labelEnd = `${((i + 1) * stepDuration).toFixed(2)}s`

      // Get SVG viewBox dimensions for label positioning
      const viewBox = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number) ?? [0, 0, 800, 600]
      const [vbX, , vbW, vbH] = viewBox

      // Background rect for subtitle
      const rectEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      )
      rectEl.setAttribute("x", String(vbX))
      rectEl.setAttribute("y", String(vbH - 50))
      rectEl.setAttribute("width", String(vbW))
      rectEl.setAttribute("height", "50")
      rectEl.setAttribute("fill", "rgba(0,0,0,0.75)")
      rectEl.setAttribute("opacity", "0")

      const rectAnim = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
      )
      rectAnim.setAttribute("attributeName", "opacity")
      rectAnim.setAttribute("from", "0")
      rectAnim.setAttribute("to", "1")
      rectAnim.setAttribute("begin", labelBegin)
      rectAnim.setAttribute("dur", `${(transitionDuration * 0.5).toFixed(2)}s`)
      rectAnim.setAttribute("fill", "freeze")
      rectEl.appendChild(rectAnim)

      // Hide at next step (unless it's the last step)
      if (i < resolvedSteps.length - 1) {
        const hideAnim = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "animate",
        )
        hideAnim.setAttribute("attributeName", "opacity")
        hideAnim.setAttribute("from", "1")
        hideAnim.setAttribute("to", "0")
        hideAnim.setAttribute("begin", labelEnd)
        hideAnim.setAttribute("dur", "0.1s")
        hideAnim.setAttribute("fill", "freeze")
        rectEl.appendChild(hideAnim)
      }

      const textEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      )
      textEl.setAttribute("x", String(vbX + vbW / 2))
      textEl.setAttribute("y", String(vbH - 18))
      textEl.setAttribute("text-anchor", "middle")
      textEl.setAttribute("fill", "white")
      textEl.setAttribute("font-size", "18")
      textEl.setAttribute("font-family", "sans-serif")
      textEl.setAttribute("opacity", "0")
      textEl.textContent = step.label

      const textAnim = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
      )
      textAnim.setAttribute("attributeName", "opacity")
      textAnim.setAttribute("from", "0")
      textAnim.setAttribute("to", "1")
      textAnim.setAttribute("begin", labelBegin)
      textAnim.setAttribute("dur", `${(transitionDuration * 0.5).toFixed(2)}s`)
      textAnim.setAttribute("fill", "freeze")
      textEl.appendChild(textAnim)

      if (i < resolvedSteps.length - 1) {
        const textHide = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "animate",
        )
        textHide.setAttribute("attributeName", "opacity")
        textHide.setAttribute("from", "1")
        textHide.setAttribute("to", "0")
        textHide.setAttribute("begin", labelEnd)
        textHide.setAttribute("dur", "0.1s")
        textHide.setAttribute("fill", "freeze")
        textEl.appendChild(textHide)
      }

      svgEl.appendChild(rectEl)
      svgEl.appendChild(textEl)
    }
  }

  // Return the animated SVG
  return svgEl.outerHTML
}

/**
 * Rough estimate of SVG path length from `d` attribute.
 * Counts M/L/C/Q commands and estimates distance.
 */
function estimatePathLength(d: string): number {
  if (!d) return 200

  // Extract all numeric coordinate pairs
  const numbers = d.match(/-?[\d.]+/g)?.map(Number) ?? []
  if (numbers.length < 4) return 200

  let length = 0
  for (let i = 2; i < numbers.length - 1; i += 2) {
    const dx = (numbers[i] ?? 0) - (numbers[i - 2] ?? 0)
    const dy = (numbers[i + 1] ?? 0) - (numbers[i - 1] ?? 0)
    length += Math.sqrt(dx * dx + dy * dy)
  }

  return Math.max(length, 50)
}
