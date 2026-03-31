// src/animation/NodeReveal.tsx
import React from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"

interface NodeRevealProps {
  /** data-mc-id selector */
  selector: string
  /** Frame at which this node starts appearing */
  startFrame: number
}

/**
 * Animates a single node: fade in with spring opacity 0→1, scale 0.8→1.
 * Injects a <style> tag targeting the node by its data-mc-id attribute.
 */
export const NodeReveal: React.FC<NodeRevealProps> = ({
  selector,
  startFrame,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const localFrame = frame - startFrame
  if (localFrame < 0) {
    return (
      <style>{`
        ${selector} {
          opacity: 0;
          transform-origin: center center;
          transform: scale(0.8);
        }
      `}</style>
    )
  }

  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.5 },
  })

  const scale = 0.8 + 0.2 * progress
  const opacity = progress

  return (
    <style>{`
      ${selector} {
        opacity: ${opacity};
        transform-origin: center center;
        transform: scale(${scale});
      }
    `}</style>
  )
}
