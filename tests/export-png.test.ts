import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { svgToPng } from "../src/export-png.js"

describe("svgToPng", () => {
  it("converts SVG string to PNG buffer", async () => {
    const svg = await renderMermaid("graph TD; A-->B;")
    const png = await svgToPng(svg)
    expect(png).toBeInstanceOf(Buffer)
    expect(png.length).toBeGreaterThan(100)
    // PNG magic bytes
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50) // P
    expect(png[2]).toBe(0x4e) // N
    expect(png[3]).toBe(0x47) // G
  })

  it("respects scale option", async () => {
    const svg = await renderMermaid("graph TD; A-->B;")
    const png1x = await svgToPng(svg, { scale: 1 })
    const png2x = await svgToPng(svg, { scale: 2 })
    expect(png2x.length).toBeGreaterThan(png1x.length)
  })
})
