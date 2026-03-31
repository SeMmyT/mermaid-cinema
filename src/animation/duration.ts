// src/animation/duration.ts

/** Auto-calculate animation duration from diagram complexity */
export function calculateDuration(
  nodeCount: number,
  edgeCount: number,
): number {
  const raw = 1 + nodeCount * 0.5 + edgeCount * 0.3
  return Math.min(raw, 30)
}

/** Convert seconds to frames at given fps */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.ceil(seconds * fps)
}

/** Frames per element for reveal mode */
export function framesPerElement(fps: number): number {
  return Math.round(fps * 0.5) // 0.5s per element
}
