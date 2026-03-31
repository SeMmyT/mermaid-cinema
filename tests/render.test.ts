import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"

describe("renderMermaid", () => {
  it("renders a simple flowchart to SVG string", async () => {
    const svg = await renderMermaid("graph TD; A-->B;")
    expect(svg).toContain("<svg")
    expect(svg).toContain("</svg>")
  })

  it("renders a sequence diagram to SVG string", async () => {
    const svg = await renderMermaid("sequenceDiagram\n  Alice->>Bob: Hello")
    expect(svg).toContain("<svg")
  })

  it("throws on invalid syntax", async () => {
    await expect(renderMermaid("not valid mermaid at all %%%"))
      .rejects.toThrow()
  })

  it("respects theme option", async () => {
    const svg = await renderMermaid("graph TD; A-->B;", { theme: "dark" })
    expect(svg).toContain("<svg")
  })

  it("respects width option", async () => {
    const svg = await renderMermaid("graph TD; A-->B;", { width: 600 })
    expect(svg).toContain("<svg")
  })
})
