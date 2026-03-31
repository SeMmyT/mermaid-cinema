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

function patchSvgElement(el: any) {
  if (!el.getBBox) {
    el.getBBox = function () {
      // Estimate text bounding box from textContent
      const text = el.textContent || ""
      const fontSize = 14
      return {
        x: 0,
        y: 0,
        width: text.length * fontSize * 0.6,
        height: fontSize * 1.4,
      }
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
      return (el.textContent || "").length * 14 * 0.6
    }
  }
}

function patchPrototypes(win: any) {
  // Patch SVGElement prototype
  const SVGElement = win.SVGElement || win.HTMLElement
  if (SVGElement && SVGElement.prototype) {
    if (!SVGElement.prototype.getBBox) {
      SVGElement.prototype.getBBox = function () {
        const text = this.textContent || ""
        const fontSize = 14
        return {
          x: 0,
          y: 0,
          width: text.length * fontSize * 0.6,
          height: fontSize * 1.4,
        }
      }
    }
    if (!SVGElement.prototype.getComputedTextLength) {
      SVGElement.prototype.getComputedTextLength = function () {
        return (this.textContent || "").length * 14 * 0.6
      }
    }
  }

  // Some mermaid paths use Element.prototype
  const Element = win.Element
  if (Element && Element.prototype && !Element.prototype.getBBox) {
    Element.prototype.getBBox = function () {
      const text = this.textContent || ""
      const fontSize = 14
      return {
        x: 0,
        y: 0,
        width: text.length * fontSize * 0.6,
        height: fontSize * 1.4,
      }
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
