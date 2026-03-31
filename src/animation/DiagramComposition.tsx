// src/animation/DiagramComposition.tsx
import React from "react"
import { AbsoluteFill, Sequence } from "remotion"
import { NodeReveal } from "./NodeReveal.js"
import { EdgeReveal } from "./EdgeReveal.js"
import { FlowEdge } from "./FlowEdge.js"
import type { PreparedSvg } from "./prepare-svg.js"

export type AnimationMode = "reveal" | "flow"

export interface DiagramCompositionProps {
  preparedSvg: PreparedSvg
  animationMode: AnimationMode
  framesPerElement: number
}

export const DiagramComposition: React.FC<DiagramCompositionProps> = ({
  preparedSvg,
  animationMode,
  framesPerElement,
}) => {
  const { svg, nodes, edges, revealOrder } = preparedSvg

  if (animationMode === "flow") {
    return <FlowMode svg={svg} edges={edges} />
  }

  return <RevealMode svg={svg} nodes={nodes} edges={edges} revealOrder={revealOrder} framesPerElement={framesPerElement} />
}

/** Flow mode: all elements visible, edges have animated dashes */
const FlowMode: React.FC<{
  svg: string
  edges: { pathSelector: string }[]
}> = ({ svg, edges }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      {edges.map((edge, i) => (
        <FlowEdge key={i} pathSelector={edge.pathSelector} />
      ))}
      <div
        style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </AbsoluteFill>
  )
}

/** Reveal mode: progressive node/edge reveal following topological order */
const RevealMode: React.FC<{
  svg: string
  nodes: PreparedSvg["nodes"]
  edges: PreparedSvg["edges"]
  revealOrder: string[]
  framesPerElement: number
}> = ({ svg, nodes, edges, revealOrder, framesPerElement }) => {
  // Build a map from mc-id to element info
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const edgeMap = new Map(edges.map((e) => [e.id, e]))

  // Calculate start frame for each element in reveal order
  const startFrames = new Map<string, number>()
  revealOrder.forEach((id, idx) => {
    startFrames.set(id, idx * framesPerElement)
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      {/* Animate nodes */}
      {nodes.map((node) => (
        <NodeReveal
          key={node.id}
          selector={node.selector}
          startFrame={startFrames.get(node.id) ?? 0}
        />
      ))}

      {/* Animate edges */}
      {edges.map((edge) => (
        <EdgeReveal
          key={edge.id}
          pathSelector={edge.pathSelector}
          pathD={edge.pathD}
          labelSelector={edge.labelSelector}
          startFrame={startFrames.get(edge.id) ?? 0}
        />
      ))}

      {/* Render the SVG */}
      <div
        style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </AbsoluteFill>
  )
}
