// src/render.ts
import { JSDOM } from "jsdom"

export interface RenderOptions {
  theme?: "default" | "dark" | "forest" | "neutral"
  width?: number
  backgroundColor?: string
}

let domReady = false

function ensureDom() {
  if (domReady) return

  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><div id=\"container\"></div></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost",
  })

  const g = globalThis as any
  const win = dom.window as any

  // Patch globals mermaid + d3 + DOMPurify need
  // Use Object.defineProperty for read-only properties like navigator
  const props: Record<string, any> = {
    window: win,
    document: win.document,
    self: win,
    navigator: win.navigator,
    DOMParser: win.DOMParser,
    XMLSerializer: win.XMLSerializer,
  }

  for (const [key, value] of Object.entries(props)) {
    try {
      Object.defineProperty(globalThis, key, {
        value,
        writable: true,
        configurable: true,
      })
    } catch {
      // Already defined and not configurable — skip
    }
  }

  // SVG elements don't have getBBox/getBoundingClientRect in jsdom.
  // Mermaid's d3 usage calls getBBox() on text elements for layout.
  // We stub them to return plausible bounding boxes.
  const origCreateElementNS = win.document.createElementNS.bind(win.document)
  win.document.createElementNS = function (ns: string, tag: string) {
    const el = origCreateElementNS(ns, tag)
    patchSvgElement(el)
    return el
  }

  // Also patch existing and future querySelector results
  patchPrototypes(win)

  domReady = true
}

function estimateBBox(el: any) {
  // Only use the element's OWN text, not children's text.
  // For <text>/<tspan> elements, use their direct text content.
  // For containers, estimate based on child count.
  const tagName = (el.tagName || "").toLowerCase()
  const fontSize = 16

  if (tagName === "text" || tagName === "tspan") {
    // Use direct text nodes only, not recursive textContent
    let directText = ""
    for (const node of el.childNodes || []) {
      if (node.nodeType === 3) directText += node.textContent || "" // TEXT_NODE
    }
    if (!directText) directText = el.textContent || ""
    const w = Math.max(directText.length * fontSize * 0.6, 20)
    return { x: 0, y: 0, width: Math.min(w, 500), height: fontSize * 1.5 }
  }

  // For non-text SVG elements, return a compact default
  const children = el.children?.length ?? 0
  return {
    x: 0,
    y: 0,
    width: Math.min(Math.max(children * 40, 50), 500),
    height: Math.min(Math.max(children * 20, 30), 300),
  }
}

function patchSvgElement(el: any) {
  if (!el.getBBox) {
    el.getBBox = function () {
      return estimateBBox(el)
    }
  }
  if (!el.getBoundingClientRect) {
    el.getBoundingClientRect = function () {
      const bbox = el.getBBox()
      return { ...bbox, top: bbox.y, left: bbox.x, bottom: bbox.y + bbox.height, right: bbox.x + bbox.width }
    }
  }
  if (!el.getComputedTextLength) {
    el.getComputedTextLength = function () {
      const text = el.textContent || ""
      return Math.min(text.length * 16 * 0.6, 500)
    }
  }
}

function patchPrototypes(win: any) {
  // Patch SVGElement prototype
  const SVGElement = win.SVGElement || win.HTMLElement
  if (SVGElement && SVGElement.prototype) {
    if (!SVGElement.prototype.getBBox) {
      SVGElement.prototype.getBBox = function () {
        return estimateBBox(this)
      }
    }
    if (!SVGElement.prototype.getComputedTextLength) {
      SVGElement.prototype.getComputedTextLength = function () {
        const text = this.textContent || ""
        return Math.min(text.length * 16 * 0.6, 500)
      }
    }
  }

  // Some mermaid paths use Element.prototype
  const Element = win.Element
  if (Element && Element.prototype && !Element.prototype.getBBox) {
    Element.prototype.getBBox = function () {
      return estimateBBox(this)
    }
  }
}

let renderCounter = 0

export async function renderMermaid(
  source: string,
  opts: RenderOptions = {},
): Promise<string> {
  ensureDom()

  // Dynamic import mermaid AFTER DOM is patched
  const { default: mermaid } = await import("mermaid")

  mermaid.initialize({
    startOnLoad: false,
    theme: opts.theme ?? "default",
    suppressErrorRendering: true,
  })

  const id = `mermaid-cinema-${++renderCounter}`

  try {
    const { svg } = await mermaid.render(id, source.trim())

    if (!svg || !svg.includes("<svg")) {
      throw new Error("Mermaid render produced empty output")
    }

    // Apply width if specified
    if (opts.width) {
      return svg.replace(/<svg /, `<svg width="${opts.width}" `)
    }

    return svg
  } catch (err: any) {
    // Clean up any leftover container elements
    try {
      const container = (globalThis as any).document?.getElementById(id)
      if (container) container.remove()
    } catch { /* ignore cleanup errors */ }

    throw new Error(`Mermaid render failed: ${err?.message ?? err}`)
  }
}
