// src/index.ts — public programmatic API
export { renderMermaid, type RenderOptions } from "./render.js"
export { svgToPng, type PngOptions } from "./export-png.js"
export { pngToPdf } from "./export-pdf.js"
export { inspectSvg, type DiagramInfo, type NodeInfo, type EdgeInfo } from "./inspect.js"
