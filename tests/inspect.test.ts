import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { inspectSvg } from "../src/inspect.js"

describe("inspectSvg", () => {
  it("extracts nodes from a flowchart SVG", async () => {
    const svg = await renderMermaid("graph TD; A[Browser]-->B[Server]")
    const info = inspectSvg(svg)
    expect(info.nodes.length).toBeGreaterThanOrEqual(2)
    expect(info.nodes.some(n => n.label.includes("Browser"))).toBe(true)
  })

  it("extracts edges from a flowchart SVG", async () => {
    const svg = await renderMermaid("graph TD; A-->B; A-->C;")
    const info = inspectSvg(svg)
    expect(info.edges.length).toBeGreaterThanOrEqual(2)
  })

  it("returns diagram type", async () => {
    const svg = await renderMermaid("graph TD; A-->B;")
    const info = inspectSvg(svg)
    expect(info.diagramType).toBeDefined()
  })
})
