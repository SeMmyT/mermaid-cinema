import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { svgToPng } from "../src/export-png.js"
import { pngToPdf } from "../src/export-pdf.js"

describe("pngToPdf", () => {
  it("converts PNG buffer to PDF buffer", async () => {
    const svg = await renderMermaid("graph TD; A-->B;")
    const png = await svgToPng(svg)
    const pdf = await pngToPdf(png)
    expect(pdf).toBeInstanceOf(Uint8Array)
    // PDF magic bytes: %PDF
    expect(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3])).toBe("%PDF")
  })
})
