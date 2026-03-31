// src/index.ts — public programmatic API
export { renderMermaid, type RenderOptions } from "./render.js"
export { svgToPng, type PngOptions } from "./export-png.js"
export { pngToPdf } from "./export-pdf.js"
export { inspectSvg, type DiagramInfo, type NodeInfo, type EdgeInfo } from "./inspect.js"

// MCP + HTTP serve (Phase 4)
export { createMcpServer, startStdioServer } from "./mcp/server.js"
export { createHttpServer, startHttpServer, type ServeOptions } from "./serve.js"

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

// Steps Engine (Phase 3) — steps.yaml parser + validator
export {
  parseSteps,
  resolveSteps,
  StepsValidationError,
  type StepDef,
  type StepsConfig,
  type ResolvedStep,
  type ResolvedSteps,
} from "./steps/parse-steps.js"

// Animated SVG (SMIL) — zero-dependency animation path
export { exportAnimatedSvg, type AsvgOptions } from "./export-asvg.js"
