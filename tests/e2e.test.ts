import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { svgToPng } from "../src/export-png.js"
import { pngToPdf } from "../src/export-pdf.js"
import { inspectSvg } from "../src/inspect.js"

const DIAGRAMS = {
  flowchart: "graph TD; A[Start]-->B{Decision}; B-->|Yes|C[End]; B-->|No|D[Loop]; D-->B;",
  sequence: "sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello Bob\n  B-->>A: Hi Alice",
  class: "classDiagram\n  class Animal {\n    +String name\n    +makeSound()\n  }",
  state: "stateDiagram-v2\n  [*] --> Active\n  Active --> Inactive\n  Inactive --> [*]",
  er: "erDiagram\n  USER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains",
  pie: 'pie title Languages\n  "JS" : 40\n  "Python" : 30\n  "Rust" : 20\n  "Other" : 10',
  gantt: "gantt\n  title Project\n  section Phase 1\n  Task A :a1, 2026-01-01, 30d\n  Task B :after a1, 20d",
}

// mindmap requires HTMLCanvasElement which jsdom doesn't provide.
// Skipped until a canvas polyfill is added.

describe("E2E: full pipeline per diagram type", () => {
  for (const [type, source] of Object.entries(DIAGRAMS)) {
    it(`renders ${type} → SVG → PNG → PDF`, async () => {
      const svg = await renderMermaid(source)
      expect(svg).toContain("<svg")

      const png = await svgToPng(svg)
      expect(png[0]).toBe(0x89) // PNG magic

      const pdf = await pngToPdf(png)
      expect(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3])).toBe("%PDF")
    })
  }
})

describe("E2E: inspect", () => {
  it("inspects flowchart and finds nodes", async () => {
    const svg = await renderMermaid(DIAGRAMS.flowchart)
    const info = inspectSvg(svg)
    expect(info.nodes.length).toBeGreaterThanOrEqual(3)
    expect(info.edges.length).toBeGreaterThanOrEqual(3)
  })
})
