// src/animation/Root.tsx
import React from "react"
import { Composition } from "remotion"
import {
  DiagramComposition,
  type DiagramCompositionProps,
} from "./DiagramComposition.js"

/**
 * Remotion Root component. Registers the DiagramComposition.
 *
 * Input props are passed via Remotion's inputProps mechanism
 * during renderMedia() calls.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition<DiagramCompositionProps>
      id="DiagramAnimation"
      component={DiagramComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        preparedSvg: {
          svg: "<svg></svg>",
          nodes: [],
          edges: [],
          revealOrder: [],
        },
        animationMode: "reveal",
        framesPerElement: 15,
      }}
    />
  )
}
