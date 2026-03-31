// src/animation/index.ts — public animation API
export { renderAnimation, type RenderAnimationOptions, type RenderAnimationResult } from "./render-animation.js"
export { prepareSvgForAnimation, type PreparedSvg, type AnimatableNode, type AnimatableEdge } from "./prepare-svg.js"
export { calculateDuration, secondsToFrames, framesPerElement } from "./duration.js"
export { DiagramComposition, type AnimationMode, type DiagramCompositionProps } from "./DiagramComposition.js"
export { NodeReveal } from "./NodeReveal.js"
export { EdgeReveal } from "./EdgeReveal.js"
export { FlowEdge } from "./FlowEdge.js"
