// src/cli.ts
import { defineCommand, runMain } from "citty"
import { readFileSync, writeFileSync } from "node:fs"
import { extname } from "node:path"
import { renderMermaid } from "./render.js"
import { svgToPng } from "./export-png.js"
import { pngToPdf } from "./export-pdf.js"

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

    // Render to SVG
    const svg = await renderMermaid(source, { theme, width, backgroundColor: args.backgroundColor })

    // Determine output format from extension
    const ext = extname(args.output).toLowerCase()

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
        console.error(`Error: unsupported output format "${ext}". Use .svg, .png, or .pdf`)
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
    version: "0.1.0",
    description: "Mermaid diagrams → SVG, PNG, PDF, GIF, MP4. No browser required.",
  },
  subCommands: { render, inspect },
})

runMain(main)
