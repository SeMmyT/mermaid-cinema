// src/cli.ts
import { defineCommand, runMain } from "citty"
import { readFileSync, writeFileSync } from "node:fs"
import { extname } from "node:path"
import { renderMermaid } from "./render.js"
import { svgToPng } from "./export-png.js"
import { pngToPdf } from "./export-pdf.js"

const ANIMATED_EXTS = new Set([".gif", ".mp4", ".webm"])
const STATIC_EXTS = new Set([".svg", ".png", ".pdf"])

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
      description: 'Animation mode: "none", "reveal", "flow" (default: auto from output format)',
    },
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

    // Determine animation mode
    let animate = args.animate as string | undefined
    if (!animate) {
      // Auto-detect: animated formats default to "reveal", static default to "none"
      if (ANIMATED_EXTS.has(ext)) {
        animate = "reveal"
      } else {
        animate = "none"
      }
    }

    // Validate: GIF/MP4 require animation
    if (ANIMATED_EXTS.has(ext) && animate === "none") {
      console.error(
        `Error: ${ext} output requires animation. Use --animate reveal or --animate flow.`,
      )
      process.exit(1)
    }

    // Validate: static formats don't support animation
    if (STATIC_EXTS.has(ext) && animate !== "none") {
      console.error(
        `Error: ${ext} output does not support animation. Use .gif or .mp4 for animated output.`,
      )
      process.exit(1)
    }

    // ─── Animated output path ───
    if (animate !== "none" && ANIMATED_EXTS.has(ext)) {
      // Dynamic import to avoid loading Remotion for static renders
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

      const result = await renderAnimation({
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
        console.error(
          `Rendered ${ext.slice(1).toUpperCase()} in ${ms}ms → ${args.output}`,
        )
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
        console.error(`Error: unsupported output format "${ext}". Use .svg, .png, .pdf, .gif, or .mp4`)
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

const main = defineCommand({
  meta: {
    name: "mermaid-cinema",
    version: "0.2.0",
    description: "Mermaid diagrams → SVG, PNG, PDF, GIF, MP4. No browser required for static output.",
  },
  subCommands: { render, inspect },
})

runMain(main)
