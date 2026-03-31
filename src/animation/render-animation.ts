// src/animation/render-animation.ts
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { renderMermaid } from "../render.js"
import { inspectSvg } from "../inspect.js"
import { prepareSvgForAnimation } from "./prepare-svg.js"
import {
  calculateDuration,
  secondsToFrames,
  framesPerElement as calcFramesPerElement,
} from "./duration.js"
import type { AnimationMode } from "./DiagramComposition.js"

export interface RenderAnimationOptions {
  source: string
  outputPath: string
  animationMode: AnimationMode
  fps?: number
  durationOverride?: number
  theme?: "default" | "dark" | "forest" | "neutral"
  width?: number
  height?: number
}

export interface RenderAnimationResult {
  outputPath: string
  durationSeconds: number
  totalFrames: number
  nodeCount: number
  edgeCount: number
}

/**
 * Full animation render pipeline:
 * 1. Render Mermaid source to SVG
 * 2. Inspect SVG for nodes/edges
 * 3. Prepare SVG for animation (inject data-mc-* attributes)
 * 4. Bundle + render via Remotion
 */
export async function renderAnimation(
  opts: RenderAnimationOptions,
): Promise<RenderAnimationResult> {
  const fps = opts.fps ?? 30

  // Step 1: Render Mermaid to SVG
  const svg = await renderMermaid(opts.source, {
    theme: opts.theme,
  })

  // Step 2: Inspect SVG
  const info = inspectSvg(svg)
  const nodeCount = info.nodes.length
  const edgeCount = info.edges.length

  // Step 3: Prepare SVG for animation
  const prepared = prepareSvgForAnimation(svg, info)

  // Step 4: Calculate duration
  const durationSeconds =
    opts.durationOverride ?? calculateDuration(nodeCount, edgeCount)
  const totalFrames = secondsToFrames(durationSeconds, fps)
  const fpe = calcFramesPerElement(fps)

  process.stderr.write(
    `Animation: ${nodeCount} nodes, ${edgeCount} edges, ${durationSeconds.toFixed(1)}s (${totalFrames} frames at ${fps}fps)\n`,
  )

  // Step 5: Determine output codec from file extension
  const ext = opts.outputPath.toLowerCase()
  let codec: string
  if (ext.endsWith(".gif")) {
    codec = "gif"
  } else if (ext.endsWith(".mp4")) {
    codec = "h264"
  } else if (ext.endsWith(".webm")) {
    codec = "vp8"
  } else {
    codec = "h264"
  }

  // Step 6: Dynamic import of Remotion modules (they're optional peer deps)
  let bundle: typeof import("@remotion/bundler").bundle
  let renderMedia: typeof import("@remotion/renderer").renderMedia
  let selectComposition: typeof import("@remotion/renderer").selectComposition

  try {
    const bundlerMod = await import("@remotion/bundler")
    bundle = bundlerMod.bundle
    const rendererMod = await import("@remotion/renderer")
    renderMedia = rendererMod.renderMedia
    selectComposition = rendererMod.selectComposition
  } catch {
    throw new Error(
      "Remotion is not installed. Animation requires these packages:\n" +
        "  pnpm add remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/paths react react-dom\n" +
        "\nStatic output (SVG, PNG, PDF) works without Remotion.",
    )
  }

  process.stderr.write("Rendering animation (this uses Chromium)...\n")

  // Step 7: Bundle the Remotion entry point
  const entryPoint = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "entry.tsx",
  )

  const bundled = await bundle({
    entryPoint,
    // Remotion needs to resolve our component imports
  })

  // Step 8: Select composition and render
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "DiagramAnimation",
    inputProps: {
      preparedSvg: prepared,
      animationMode: opts.animationMode,
      framesPerElement: fpe,
    },
  })

  // Override composition settings
  const compositionWithOverrides = {
    ...composition,
    durationInFrames: totalFrames,
    fps,
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
  }

  const renderOpts: Parameters<typeof renderMedia>[0] = {
    composition: compositionWithOverrides,
    serveUrl: bundled,
    codec: codec as any,
    outputLocation: resolve(opts.outputPath),
    inputProps: {
      preparedSvg: prepared,
      animationMode: opts.animationMode,
      framesPerElement: fpe,
    },
  }

  // For GIF, skip every other frame to keep file size reasonable
  if (codec === "gif") {
    renderOpts.everyNthFrame = 2
  }

  await renderMedia(renderOpts)

  process.stderr.write(
    `Animation rendered → ${opts.outputPath}\n`,
  )

  return {
    outputPath: resolve(opts.outputPath),
    durationSeconds,
    totalFrames,
    nodeCount,
    edgeCount,
  }
}
