// src/index.ts — public programmatic API
export { renderMermaid, type RenderOptions } from "./render.js"
export { svgToPng, type PngOptions } from "./export-png.js"
export { pngToPdf } from "./export-pdf.js"
export { inspectSvg, type DiagramInfo, type NodeInfo, type EdgeInfo } from "./inspect.js"

// Animation (Phase 2) — requires optional Remotion peer deps
export {
  renderAnimation,
  prepareSvgForAnimation,
  calculateDuration,
  secondsToFrames,
  framesPerElement,
  type RenderAnimationOptions,
  type RenderAnimationResult,
  type PreparedSvg,
  type AnimatableNode,
  type AnimatableEdge,
  type AnimationMode,
} from "./animation/index.js"
