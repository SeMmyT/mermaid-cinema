// src/cli.ts
import { defineCommand, runMain } from "citty"
import { readFileSync, writeFileSync } from "node:fs"
import { extname } from "node:path"
import { renderMermaid } from "./render.js"
import { svgToPng } from "./export-png.js"
import { pngToPdf } from "./export-pdf.js"

const ANIMATED_EXTS = new Set([".gif", ".mp4", ".webm"])
const STATIC_EXTS = new Set([".svg", ".png", ".pdf"])
const ASVG_EXT = ".asvg"

const render = defineCommand({
  meta: { name: "render", description: "Render a Mermaid diagram" },
  args: {
    input: { type: "positional", description: "Input .mmd file (or stdin)", required: false },
    output: { type: "string", alias: "o", description: "Output file path", required: true },
    theme: { type: "string", alias: "t", description: "Theme: default, dark, forest, neutral", default: "default" },
    scale: { type: "string", alias: "s", description: "PNG scale factor", default: "2" },
    backgroundColor: { type: "string", alias: "bg", description: "Background color" },
    width: { type: "string", alias: "w", description: "SVG width override" },
    quiet: { type: "boolean", alias: "q", description: "Suppress output", default: false },
    animate: {
      type: "string",
      alias: "a",
      description: 'Animation mode: "none", "reveal", "flow", "steps" (default: auto from output format)',
    },
    steps: { type: "string", description: "Path to steps.yaml file for step-by-step animation" },
    fps: { type: "string", description: "Animation frames per second", default: "30" },
    duration: { type: "string", description: "Animation duration in seconds (overrides auto-calculation)" },
  },
  async run({ args }) {
    const start = performance.now()

    // Read input
    let source: string
    if (args.input) {
      source = readFileSync(args.input, "utf-8")
    } else {
      // Read from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      source = Buffer.concat(chunks).toString("utf-8")
    }

    if (!source.trim()) {
      console.error("Error: empty input")
      process.exit(1)
    }

    const theme = args.theme as "default" | "dark" | "forest" | "neutral"
    const scale = parseFloat(args.scale)
    const width = args.width ? parseInt(args.width) : undefined
    const fps = parseInt(args.fps)
    const durationOverride = args.duration ? parseFloat(args.duration) : undefined

    const ext = extname(args.output).toLowerCase()

    // If --steps provided, implicitly set animate to "steps"
    let animate = args.animate as string | undefined
    if (args.steps && !animate) {
      animate = "steps"
    }

    // Determine animation mode
    if (!animate) {
      if (ANIMATED_EXTS.has(ext) || ext === ASVG_EXT) {
        animate = "reveal"
      } else {
        animate = "none"
      }
    }

    // Validate: steps mode requires --steps file
    if (animate === "steps" && !args.steps) {
      console.error("Error: --animate steps requires --steps <path> to a steps.yaml file.")
      process.exit(1)
    }

    // Validate: steps mode only works with animated formats or .asvg
    if (animate === "steps" && !ANIMATED_EXTS.has(ext) && ext !== ASVG_EXT) {
      console.error(`Error: steps mode only works with .gif, .mp4, .webm, or .asvg output.`)
      process.exit(1)
    }

    // Validate: GIF/MP4 require animation
    if (ANIMATED_EXTS.has(ext) && animate === "none") {
      console.error(
        `Error: ${ext} output requires animation. Use --animate reveal or --animate flow.`,
      )
      process.exit(1)
    }

    // Validate: static formats don't support animation (except .asvg)
    if (STATIC_EXTS.has(ext) && animate !== "none") {
      console.error(
        `Error: ${ext} output does not support animation. Use .gif, .mp4, or .asvg for animated output.`,
      )
      process.exit(1)
    }

    // ─── ASVG output path (SMIL animated SVG — no Remotion) ───
    if (ext === ASVG_EXT) {
      const svg = await renderMermaid(source, { theme, width, backgroundColor: args.backgroundColor })
      const { inspectSvg } = await import("./inspect.js")
      const diagram = inspectSvg(svg)
      const { parseSteps, resolveSteps } = await import("./steps/parse-steps.js")
      const { exportAnimatedSvg } = await import("./export-asvg.js")

      if (animate === "steps" && args.steps) {
        const stepsYaml = readFileSync(args.steps, "utf-8")
        const stepsConfig = parseSteps(stepsYaml)
        if (durationOverride) stepsConfig.duration = durationOverride
        const resolved = resolveSteps(stepsConfig, diagram)

        const asvg = exportAnimatedSvg({ svg, diagram, config: stepsConfig, resolvedSteps: resolved.steps })
        writeFileSync(args.output, asvg, "utf-8")
      } else {
        // Auto-generate steps from diagram topology
        const autoStepDefs = diagram.nodes.map((n) => ({
          show: [n.id] as string[],
          connect: [] as string[],
          highlight: [] as string[],
          label: "",
          style: {} as Record<string, Record<string, string>>,
        }))
        if (autoStepDefs.length === 0) {
          autoStepDefs.push({ show: [], connect: [], highlight: [], label: "", style: {} })
        }
        for (const edge of diagram.edges) {
          const idx = autoStepDefs.findIndex((s) => s.show.includes(edge.target))
          if (idx >= 0) autoStepDefs[idx].connect.push(`${edge.source}-->${edge.target}`)
        }
        const autoConfig = {
          fps,
          duration: durationOverride ?? ("auto" as const),
          transition: "spring" as const,
          steps: autoStepDefs,
        }
        const resolved = resolveSteps(autoConfig, diagram)
        const asvg = exportAnimatedSvg({ svg, diagram, config: autoConfig, resolvedSteps: resolved.steps })
        writeFileSync(args.output, asvg, "utf-8")
      }

      if (!args.quiet) {
        const ms = (performance.now() - start).toFixed(0)
        console.error(`Rendered ASVG in ${ms}ms → ${args.output}`)
      }
      return
    }

    // ─── Steps animation via Remotion (GIF/MP4 with --steps) ───
    if (animate === "steps" && args.steps && ANIMATED_EXTS.has(ext)) {
      const { inspectSvg } = await import("./inspect.js")
      const { parseSteps, resolveSteps } = await import("./steps/parse-steps.js")

      const svgForValidation = await renderMermaid(source, { theme, width, backgroundColor: args.backgroundColor })
      const diagram = inspectSvg(svgForValidation)
      const stepsYaml = readFileSync(args.steps, "utf-8")
      const stepsConfig = parseSteps(stepsYaml)
      resolveSteps(stepsConfig, diagram) // validates references

      if (!args.quiet) {
        console.error(`Steps: ${stepsConfig.steps.length} steps from ${args.steps}`)
      }

      let renderAnimation: typeof import("./animation/render-animation.js").renderAnimation
      try {
        const mod = await import("./animation/render-animation.js")
        renderAnimation = mod.renderAnimation
      } catch {
        console.error(
          "Error: Steps animation with video output requires Remotion.\n" +
            "  Use .asvg output for zero-dependency animated SVG.",
        )
        process.exit(1)
      }

      await renderAnimation({
        source,
        outputPath: args.output,
        animationMode: "reveal",
        fps: stepsConfig.fps,
        durationOverride: stepsConfig.duration === "auto" ? undefined : stepsConfig.duration,
        theme,
        width: width ?? 1920,
        height: 1080,
      })

      if (!args.quiet) {
        const ms = (performance.now() - start).toFixed(0)
        console.error(`Rendered ${ext.slice(1).toUpperCase()} in ${ms}ms → ${args.output}`)
      }
      return
    }

    // ─── Animated output path (reveal/flow via Remotion) ───
    if (animate !== "none" && ANIMATED_EXTS.has(ext)) {
      let renderAnimation: typeof import("./animation/render-animation.js").renderAnimation
      try {
        const mod = await import("./animation/render-animation.js")
        renderAnimation = mod.renderAnimation
      } catch {
        console.error(
          "Error: Animation requires Remotion. Install with:\n" +
            "  pnpm add remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/paths react react-dom",
        )
        process.exit(1)
      }

      await renderAnimation({
        source,
        outputPath: args.output,
        animationMode: animate as "reveal" | "flow",
        fps,
        durationOverride,
        theme,
        width: width ?? 1920,
        height: 1080,
      })

      if (!args.quiet) {
        const ms = (performance.now() - start).toFixed(0)
        console.error(`Rendered ${ext.slice(1).toUpperCase()} in ${ms}ms → ${args.output}`)
      }
      return
    }

    // ─── Static output path (Phase 1) ───
    const svg = await renderMermaid(source, { theme, width, backgroundColor: args.backgroundColor })

    switch (ext) {
      case ".svg": {
        writeFileSync(args.output, svg, "utf-8")
        break
      }
      case ".png": {
        const png = await svgToPng(svg, { scale, backgroundColor: args.backgroundColor })
        writeFileSync(args.output, png)
        break
      }
      case ".pdf": {
        const png = await svgToPng(svg, { scale, backgroundColor: args.backgroundColor })
        const pdf = await pngToPdf(png)
        writeFileSync(args.output, pdf)
        break
      }
      default: {
        console.error(`Error: unsupported output format "${ext}". Use .svg, .png, .pdf, .gif, .mp4, or .asvg`)
        process.exit(1)
      }
    }

    if (!args.quiet) {
      const ms = (performance.now() - start).toFixed(0)
      console.error(`Rendered ${ext.slice(1).toUpperCase()} in ${ms}ms → ${args.output}`)
    }
  },
})

const inspect = defineCommand({
  meta: { name: "inspect", description: "Inspect diagram node IDs and labels" },
  args: {
    input: { type: "positional", description: "Input .mmd file", required: true },
  },
  async run({ args }) {
    const source = readFileSync(args.input, "utf-8")
    const svg = await renderMermaid(source)

    const { inspectSvg } = await import("./inspect.js")
    const info = inspectSvg(svg)

    console.log(`Diagram type: ${info.diagramType}`)
    console.log(`SVG size: ${info.svgWidth} x ${info.svgHeight}`)
    console.log(`\nNodes (${info.nodes.length}):`)
    for (const node of info.nodes) {
      console.log(`  ${node.id} → "${node.label}"`)
    }
    console.log(`\nEdges (${info.edges.length}):`)
    for (const edge of info.edges) {
      console.log(`  ${edge.source} → ${edge.target}`)
    }
  },
})

const mcp = defineCommand({
  meta: { name: "mcp", description: "Start MCP server (stdio transport for Claude Code / Cursor)" },
  args: {
    port: {
      type: "string",
      description: "HTTP port (future, currently stubbed)",
      required: false,
    },
  },
  async run({ args }) {
    if (args.port) {
      console.error("HTTP transport not yet implemented. Use stdio (default).")
      process.exit(1)
    }
    const { startStdioServer } = await import("./mcp/server.js")
    await startStdioServer()
  },
})

const serve = defineCommand({
  meta: { name: "serve", description: "Start HTTP render server" },
  args: {
    port: {
      type: "string",
      alias: "p",
      description: "Port to listen on",
      default: "3000",
    },
    host: {
      type: "string",
      alias: "H",
      description: "Host to bind to",
      default: "127.0.0.1",
    },
  },
  async run({ args }) {
    const { startHttpServer } = await import("./serve.js")
    await startHttpServer({
      port: parseInt(args.port),
      host: args.host,
    })
  },
})

const main = defineCommand({
  meta: {
    name: "mermaid-cinema",
    version: "0.2.0",
    description: "Mermaid diagrams → SVG, PNG, PDF, GIF, MP4. No browser required for static output.",
  },
  subCommands: { render, inspect, mcp, serve },
})

runMain(main)
