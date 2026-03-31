// src/animation/EdgeReveal.tsx
import React from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import { evolvePath } from "@remotion/paths"

interface EdgeRevealProps {
  /** CSS selector for the edge path element */
  pathSelector: string
  /** SVG path `d` attribute */
  pathD: string
  /** CSS selector for the edge label */
  labelSelector: string | null
  /** Frame at which this edge starts drawing */
  startFrame: number
}

/**
 * Animates a single edge: stroke draws via evolvePath, label fades in at end.
 */
export const EdgeReveal: React.FC<EdgeRevealProps> = ({
  pathSelector,
  pathD,
  labelSelector,
  startFrame,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const localFrame = frame - startFrame
  if (localFrame < 0) {
    return (
      <style>{`
        ${pathSelector} {
          stroke-dasharray: 9999;
          stroke-dashoffset: 9999;
        }
        ${labelSelector ? `${labelSelector} { opacity: 0; }` : ""}
      `}</style>
    )
  }

  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 80, mass: 0.8 },
  })

  // Use evolvePath to get strokeDasharray and strokeDashoffset
  let strokeStyle = ""
  try {
    if (pathD) {
      const evolved = evolvePath(progress, pathD)
      strokeStyle = `
        stroke-dasharray: ${evolved.strokeDasharray};
        stroke-dashoffset: ${evolved.strokeDashoffset};
      `
    }
  } catch {
    // If path parsing fails, fall back to opacity animation
    strokeStyle = `opacity: ${progress};`
  }

  const labelOpacity = Math.max(0, (progress - 0.7) / 0.3) // fade in at 70%+

  return (
    <style>{`
      ${pathSelector} {
        ${strokeStyle}
      }
      ${labelSelector ? `${labelSelector} { opacity: ${labelOpacity}; }` : ""}
    `}</style>
  )
}
