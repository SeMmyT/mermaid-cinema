import { describe, it, expect } from "vitest"
import { renderMermaid } from "../src/render.js"
import { inspectSvg, type DiagramInfo } from "../src/inspect.js"
import {
  parseSteps,
  resolveSteps,
  StepsValidationError,
  type StepsConfig,
} from "../src/steps/parse-steps.js"
import { exportAnimatedSvg } from "../src/export-asvg.js"

// ─── Helper: render a diagram and return its DiagramInfo ───

async function getDiagram(source: string): Promise<{ svg: string; info: DiagramInfo }> {
  const svg = await renderMermaid(source)
  const info = inspectSvg(svg)
  return { svg, info }
}

// ─── YAML parsing ───

describe("parseSteps", () => {
  it("parses valid steps YAML", () => {
    const yaml = `
title: "Auth flow"
fps: 24
duration: 10
transition: ease
steps:
  - show: [A]
    label: "Start"
  - show: [B]
    connect: [A-->B]
    label: "Connect"
`
    const config = parseSteps(yaml)
    expect(config.title).toBe("Auth flow")
    expect(config.fps).toBe(24)
    expect(config.duration).toBe(10)
    expect(config.transition).toBe("ease")
    expect(config.steps).toHaveLength(2)
    expect(config.steps[0].show).toEqual(["A"])
    expect(config.steps[0].label).toBe("Start")
    expect(config.steps[1].connect).toEqual(["A-->B"])
  })

  it("uses defaults for optional fields", () => {
    const yaml = `
steps:
  - show: [X]
`
    const config = parseSteps(yaml)
    expect(config.fps).toBe(30)
    expect(config.duration).toBe("auto")
    expect(config.transition).toBe("spring")
    expect(config.title).toBeUndefined()
  })

  it("parses highlight and style", () => {
    const yaml = `
steps:
  - show: [A]
    highlight: [A]
    style:
      A:
        fill: "#22c55e"
`
    const config = parseSteps(yaml)
    expect(config.steps[0].highlight).toEqual(["A"])
    expect(config.steps[0].style).toEqual({ A: { fill: "#22c55e" } })
  })
})

// ─── Validation: missing steps ───

describe("parseSteps validation", () => {
  it("throws on empty steps array", () => {
    expect(() => parseSteps("steps: []")).toThrow(StepsValidationError)
    expect(() => parseSteps("steps: []")).toThrow("at least 1 step")
  })

  it("throws on missing steps key", () => {
    expect(() => parseSteps("title: test")).toThrow(StepsValidationError)
  })

  it("throws when step has no show/connect/highlight", () => {
    const yaml = `
steps:
  - label: "Just a label"
`
    expect(() => parseSteps(yaml)).toThrow("at least one of")
  })

  it("throws on invalid transition", () => {
    const yaml = `
transition: bounce
steps:
  - show: [A]
`
    expect(() => parseSteps(yaml)).toThrow("Invalid transition")
  })
})

// ─── Validation against diagram ───

describe("resolveSteps", () => {
  it("resolves valid node references by ID", async () => {
    const { info } = await getDiagram("graph TD; A[Browser]-->B[Server]")

    // Use actual node IDs from the diagram
    const nodeIds = info.nodes.map((n) => n.id)
    expect(nodeIds.length).toBeGreaterThanOrEqual(2)

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: [nodeIds[0]], label: "first" }],
    }

    const resolved = resolveSteps(config, info)
    expect(resolved.steps[0].showNodeIds).toEqual([nodeIds[0]])
  })

  it("resolves node references by label (case-insensitive)", async () => {
    const { info } = await getDiagram("graph TD; A[Browser]-->B[Server]")

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: ["browser"], label: "fuzzy match" }],
    }

    const resolved = resolveSteps(config, info)
    // Should resolve "browser" to the node with label "Browser"
    const browserNode = info.nodes.find((n) => n.label.toLowerCase().includes("browser"))
    expect(browserNode).toBeDefined()
    expect(resolved.steps[0].showNodeIds[0]).toBe(browserNode!.id)
  })

  it("throws on invalid node reference", async () => {
    const { info } = await getDiagram("graph TD; A[Browser]-->B[Server]")

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: ["NonExistentNode"], label: "bad ref" }],
    }

    expect(() => resolveSteps(config, info)).toThrow(StepsValidationError)
    expect(() => resolveSteps(config, info)).toThrow("not found in diagram")
  })

  it("resolves edge references in Source-->Target format", async () => {
    const { info } = await getDiagram("graph TD; A[Browser]-->B[Server]")

    // Use actual node IDs
    const nodeA = info.nodes.find((n) => n.label.includes("Browser"))
    const nodeB = info.nodes.find((n) => n.label.includes("Server"))
    expect(nodeA).toBeDefined()
    expect(nodeB).toBeDefined()

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [
        {
          show: [nodeA!.id],
          connect: [`${nodeA!.id}-->${nodeB!.id}`],
          label: "connect",
        },
      ],
    }

    const resolved = resolveSteps(config, info)
    expect(resolved.steps[0].connectEdges).toHaveLength(1)
    expect(resolved.steps[0].connectEdges[0].source).toBe(nodeA!.id)
    expect(resolved.steps[0].connectEdges[0].target).toBe(nodeB!.id)
  })

  it("throws on invalid edge format", async () => {
    const { info } = await getDiagram("graph TD; A-->B")
    const nodeId = info.nodes[0]?.id ?? "A"

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: [nodeId], connect: ["bad_edge_format"], label: "" }],
    }

    expect(() => resolveSteps(config, info)).toThrow("invalid edge format")
  })
})

// ─── Duration calculation for steps mode ───

describe("steps duration", () => {
  it("auto duration based on step count", () => {
    const config = parseSteps(`
steps:
  - show: [A]
  - show: [B]
  - show: [C]
`)
    // Auto duration: 1 + stepCount * 2 = 1 + 3*2 = 7
    expect(config.duration).toBe("auto")
    expect(config.steps).toHaveLength(3)
  })

  it("explicit duration is preserved", () => {
    const config = parseSteps(`
duration: 15
steps:
  - show: [A]
`)
    expect(config.duration).toBe(15)
  })
})

// ─── SMIL animated SVG output ───

describe("exportAnimatedSvg", () => {
  it("produces SVG with animate elements", async () => {
    const { svg, info } = await getDiagram("graph TD; A[Browser]-->B[Server]")

    // Build minimal resolved steps using actual node IDs
    const nodeA = info.nodes.find((n) => n.label.includes("Browser"))!
    const nodeB = info.nodes.find((n) => n.label.includes("Server"))!

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [
        { show: [nodeA.id], label: "Show browser" },
        { show: [nodeB.id], label: "Show server" },
      ],
    }
    const resolved = resolveSteps(config, info)

    const asvg = exportAnimatedSvg({
      svg,
      diagram: info,
      config,
      resolvedSteps: resolved.steps,
    })

    expect(asvg).toContain("<svg")
    expect(asvg).toContain("<animate")
    expect(asvg).toContain("opacity")
  })

  it("injects labels as text elements", async () => {
    const { svg, info } = await getDiagram("graph TD; A[Start]-->B[End]")

    const nodeA = info.nodes.find((n) => n.label.includes("Start"))!
    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: [nodeA.id], label: "My label text" }],
    }
    const resolved = resolveSteps(config, info)

    const asvg = exportAnimatedSvg({
      svg,
      diagram: info,
      config,
      resolvedSteps: resolved.steps,
    })

    expect(asvg).toContain("My label text")
    expect(asvg).toContain("<text")
  })

  it("animates edges with stroke-dashoffset", async () => {
    const { svg, info } = await getDiagram("graph TD; A[Start]-->B[End]")

    const nodeA = info.nodes.find((n) => n.label.includes("Start"))!
    const nodeB = info.nodes.find((n) => n.label.includes("End"))!

    const edgeRef = `${nodeA.id}-->${nodeB.id}`

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [
        { show: [nodeA.id, nodeB.id], connect: [edgeRef], label: "Draw edge" },
      ],
    }
    const resolved = resolveSteps(config, info)

    const asvg = exportAnimatedSvg({
      svg,
      diagram: info,
      config,
      resolvedSteps: resolved.steps,
    })

    expect(asvg).toContain("stroke-dashoffset")
  })

  it("includes animateTransform for highlighted nodes", async () => {
    const { svg, info } = await getDiagram("graph TD; A[Start]-->B[End]")

    const nodeA = info.nodes.find((n) => n.label.includes("Start"))!

    const config: StepsConfig = {
      fps: 30,
      duration: "auto",
      transition: "spring",
      steps: [{ show: [nodeA.id], highlight: [nodeA.id], label: "Highlight" }],
    }
    const resolved = resolveSteps(config, info)

    const asvg = exportAnimatedSvg({
      svg,
      diagram: info,
      config,
      resolvedSteps: resolved.steps,
    })

    expect(asvg).toContain("animateTransform")
    expect(asvg).toContain("scale")
  })
})
