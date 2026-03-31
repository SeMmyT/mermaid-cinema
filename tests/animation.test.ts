import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { inspectSvg } from "../src/inspect.js"
import { prepareSvgForAnimation } from "../src/animation/prepare-svg.js"
import {
  calculateDuration,
  secondsToFrames,
  framesPerElement,
} from "../src/animation/duration.js"

// ─── Duration formula tests ───

describe("calculateDuration", () => {
  it("returns 1s for empty diagram", () => {
    expect(calculateDuration(0, 0)).toBe(1)
  })

  it("calculates correctly for small diagram", () => {
    // 1 + (3 * 0.5) + (2 * 0.3) = 1 + 1.5 + 0.6 = 3.1
    expect(calculateDuration(3, 2)).toBeCloseTo(3.1)
  })

  it("calculates correctly for medium diagram", () => {
    // 1 + (10 * 0.5) + (12 * 0.3) = 1 + 5 + 3.6 = 9.6
    expect(calculateDuration(10, 12)).toBeCloseTo(9.6)
  })

  it("caps at 30 seconds for large diagrams", () => {
    // 1 + (100 * 0.5) + (100 * 0.3) = 1 + 50 + 30 = 81 → capped at 30
    expect(calculateDuration(100, 100)).toBe(30)
  })

  it("caps at exactly 30 for edge case", () => {
    // 1 + (40 * 0.5) + (30 * 0.3) = 1 + 20 + 9 = 30 → exactly 30
    expect(calculateDuration(40, 30)).toBe(30)
  })
})

describe("secondsToFrames", () => {
  it("converts seconds to frames at 30fps", () => {
    expect(secondsToFrames(3, 30)).toBe(90)
  })

  it("converts seconds to frames at 60fps", () => {
    expect(secondsToFrames(2, 60)).toBe(120)
  })

  it("rounds up fractional frames", () => {
    expect(secondsToFrames(3.1, 30)).toBe(93)
  })
})

describe("framesPerElement", () => {
  it("returns 15 frames at 30fps (0.5s per element)", () => {
    expect(framesPerElement(30)).toBe(15)
  })

  it("returns 30 frames at 60fps (0.5s per element)", () => {
    expect(framesPerElement(60)).toBe(30)
  })
})

// ─── SVG preparation tests ───

describe("prepareSvgForAnimation", () => {
  it("injects data-mc-id attributes on nodes", async () => {
    const svg = await renderMermaid("graph TD; A[Start]-->B[End]")
    const info = inspectSvg(svg)
    const prepared = prepareSvgForAnimation(svg, info)

    expect(prepared.svg).toContain("data-mc-id")
    expect(prepared.nodes.length).toBeGreaterThanOrEqual(2)
    for (const node of prepared.nodes) {
      expect(node.id).toMatch(/^mc-node-/)
      expect(node.selector).toContain("[data-mc-id=")
    }
  })

  it("extracts edge path data", async () => {
    const svg = await renderMermaid("graph TD; A-->B; B-->C")
    const info = inspectSvg(svg)
    const prepared = prepareSvgForAnimation(svg, info)

    expect(prepared.edges.length).toBeGreaterThanOrEqual(2)
    for (const edge of prepared.edges) {
      expect(edge.id).toMatch(/^mc-edge-/)
      expect(edge.pathSelector).toContain("[data-mc-id=")
    }
  })

  it("builds a reveal order", async () => {
    const svg = await renderMermaid("graph TD; A-->B; B-->C")
    const info = inspectSvg(svg)
    const prepared = prepareSvgForAnimation(svg, info)

    expect(prepared.revealOrder.length).toBeGreaterThan(0)
    // All nodes and edges should be in the order
    const allIds = [
      ...prepared.nodes.map((n) => n.id),
      ...prepared.edges.map((e) => e.id),
    ]
    for (const id of allIds) {
      expect(prepared.revealOrder).toContain(id)
    }
  })

  it("puts source nodes before their edges in reveal order", async () => {
    const svg = await renderMermaid("graph TD; A-->B")
    const info = inspectSvg(svg)
    const prepared = prepareSvgForAnimation(svg, info)

    // Find source node and its edge in the order
    const sourceNode = prepared.nodes.find((n) => n.id.includes("A"))
    const edge = prepared.edges[0]
    if (sourceNode && edge) {
      const nodeIdx = prepared.revealOrder.indexOf(sourceNode.id)
      const edgeIdx = prepared.revealOrder.indexOf(edge.id)
      expect(nodeIdx).toBeLessThan(edgeIdx)
    }
  })

  it("handles diagram with no edges", async () => {
    // Pie chart has nodes but no edges in the traditional sense
    const svg = await renderMermaid('pie title Test\n  "A" : 50\n  "B" : 50')
    const info = inspectSvg(svg)
    const prepared = prepareSvgForAnimation(svg, info)

    // Should not throw, even with zero edges
    expect(prepared.svg).toContain("<svg")
    expect(prepared.revealOrder).toBeDefined()
  })
})

// ─── Component import tests ───

describe("DiagramComposition", () => {
  it("can be imported", async () => {
    const mod = await import("../src/animation/DiagramComposition.js")
    expect(mod.DiagramComposition).toBeDefined()
    expect(typeof mod.DiagramComposition).toBe("function")
  })
})

describe("NodeReveal", () => {
  it("can be imported", async () => {
    const mod = await import("../src/animation/NodeReveal.js")
    expect(mod.NodeReveal).toBeDefined()
    expect(typeof mod.NodeReveal).toBe("function")
  })
})

describe("EdgeReveal", () => {
  it("can be imported", async () => {
    const mod = await import("../src/animation/EdgeReveal.js")
    expect(mod.EdgeReveal).toBeDefined()
    expect(typeof mod.EdgeReveal).toBe("function")
  })
})

describe("FlowEdge", () => {
  it("can be imported", async () => {
    const mod = await import("../src/animation/FlowEdge.js")
    expect(mod.FlowEdge).toBeDefined()
    expect(typeof mod.FlowEdge).toBe("function")
  })
})

describe("renderAnimation", () => {
  it("can be imported", async () => {
    const mod = await import("../src/animation/render-animation.js")
    expect(mod.renderAnimation).toBeDefined()
    expect(typeof mod.renderAnimation).toBe("function")
  })
})
