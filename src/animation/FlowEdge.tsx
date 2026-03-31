// src/animation/FlowEdge.tsx
import React from "react"
import { useCurrentFrame, useVideoConfig } from "remotion"

interface FlowEdgeProps {
  /** CSS selector for the edge path element */
  pathSelector: string
  /** Approximate length of the path for dash calculation */
  dashLength?: number
}

/**
 * Animates edge with flowing stroke-dashoffset loop (ByteByteGo style).
 * All nodes visible. Edges have continuous animated dashes.
 */
export const FlowEdge: React.FC<FlowEdgeProps> = ({
  pathSelector,
  dashLength = 20,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Move at a steady pace: 2 dash-lengths per second
  const speed = (dashLength * 2) / fps
  const offset = -(frame * speed) % (dashLength * 2)

  return (
    <style>{`
      ${pathSelector} {
        stroke-dasharray: ${dashLength} ${dashLength};
        stroke-dashoffset: ${offset};
      }
    `}</style>
  )
}
