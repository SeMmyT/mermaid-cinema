// src/animation/StepsComposition.tsx
import React from "react"
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion"
import { evolvePath } from "@remotion/paths"
import type { PreparedSvg } from "./prepare-svg.js"
import type { ResolvedStep, StepsConfig } from "../steps/parse-steps.js"

export interface StepsCompositionProps {
  preparedSvg: PreparedSvg
  resolvedSteps: ResolvedStep[]
  stepsConfig: StepsConfig
}

const PAUSE_FRAMES = 10

/**
 * Remotion composition for step-by-step animation.
 * Each step gets a Sequence; nodes fade in, edges draw, highlights pulse.
 */
export const StepsComposition: React.FC<StepsCompositionProps> = ({
  preparedSvg,
  resolvedSteps,
  stepsConfig,
}) => {
  const { fps, durationInFrames } = useVideoConfig()
  const totalSteps = resolvedSteps.length

  // Distribute frames across steps (with pause between)
  const totalPause = PAUSE_FRAMES * (totalSteps - 1)
  const framesPerStep = Math.max(
    1,
    Math.floor((durationInFrames - totalPause) / totalSteps),
  )

  // Track cumulative visible state
  const visibleNodes = new Set<string>()
  const visibleEdges = new Set<string>()

  // Build sequences
  const sequences: React.ReactNode[] = []
  let frameOffset = 0

  for (let i = 0; i < resolvedSteps.length; i++) {
    const step = resolvedSteps[i]
    const from = frameOffset
    const dur = framesPerStep + (i < resolvedSteps.length - 1 ? PAUSE_FRAMES : 0)

    // Collect which nodes/edges are new in THIS step
    const newNodes = step.showNodeIds.filter((id) => !visibleNodes.has(id))
    const newEdges = step.connectEdges.filter(
      (e) => !visibleEdges.has(e.edgeId),
    )
    const highlightIds = step.highlightNodeIds

    // Mark as visible for future steps
    for (const id of step.showNodeIds) visibleNodes.add(id)
    for (const e of step.connectEdges) visibleEdges.add(e.edgeId)

    // Snapshot the state at this step for the renderer
    const allVisibleNodes = new Set(visibleNodes)
    const allVisibleEdges = new Set(visibleEdges)

    sequences.push(
      <Sequence key={i} from={from} durationInFrames={dur}>
        <StepRenderer
          preparedSvg={preparedSvg}
          newNodes={newNodes}
          newEdges={newEdges}
          highlightIds={highlightIds}
          allVisibleNodes={allVisibleNodes}
          allVisibleEdges={allVisibleEdges}
          label={step.label}
          styleOverrides={step.style}
          transition={stepsConfig.transition}
          stepDuration={framesPerStep}
        />
      </Sequence>,
    )

    frameOffset += dur
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hidden style: initially hide all nodes and edges */}
      <GlobalHider preparedSvg={preparedSvg} />
      {sequences}
      {/* Render the SVG once */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 40,
        }}
        dangerouslySetInnerHTML={{ __html: preparedSvg.svg }}
      />
    </AbsoluteFill>
  )
}

/** Inject a <style> that hides all nodes/edges initially */
const GlobalHider: React.FC<{ preparedSvg: PreparedSvg }> = ({
  preparedSvg,
}) => {
  const rules = [
    ...preparedSvg.nodes.map(
      (n) => `${n.selector} { opacity: 0; transform: scale(0.8); transform-origin: center center; }`,
    ),
    ...preparedSvg.edges.map(
      (e) =>
        `${e.pathSelector} { stroke-dasharray: 9999; stroke-dashoffset: 9999; }`,
    ),
  ]

  return <style>{rules.join("\n")}</style>
}

/** Render a single step's animations */
const StepRenderer: React.FC<{
  preparedSvg: PreparedSvg
  newNodes: string[]
  newEdges: Array<{ source: string; target: string; edgeId: string }>
  highlightIds: string[]
  allVisibleNodes: Set<string>
  allVisibleEdges: Set<string>
  label: string
  styleOverrides: Record<string, Record<string, string>>
  transition: "spring" | "ease" | "linear"
  stepDuration: number
}> = ({
  preparedSvg,
  newNodes,
  newEdges,
  highlightIds,
  allVisibleNodes,
  allVisibleEdges,
  label,
  styleOverrides,
  transition,
  stepDuration,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const nodeMap = new Map(preparedSvg.nodes.map((n) => [n.id.replace("mc-node-", ""), n]))
  const edgeMap = new Map(preparedSvg.edges.map((e) => [e.id.replace("mc-edge-", ""), e]))

  // Calculate transition progress
  const progress = transitionProgress(frame, fps, transition)

  const styles: string[] = []

  // Already-visible nodes: keep fully visible
  for (const nodeId of allVisibleNodes) {
    const node = nodeMap.get(nodeId)
    if (!node) continue
    if (newNodes.includes(nodeId)) continue // handled below
    styles.push(`${node.selector} { opacity: 1; transform: scale(1); transform-origin: center center; }`)
  }

  // Already-visible edges: keep fully drawn
  for (const edgeId of allVisibleEdges) {
    const edge = edgeMap.get(edgeId)
    if (!edge) continue
    const isNew = newEdges.some((e) => e.edgeId === edgeId)
    if (isNew) continue // handled below
    styles.push(`${edge.pathSelector} { stroke-dasharray: none; stroke-dashoffset: 0; }`)
  }

  // New nodes: fade in with transition
  for (const nodeId of newNodes) {
    const node = nodeMap.get(nodeId)
    if (!node) continue
    const scale = 0.8 + 0.2 * progress
    styles.push(
      `${node.selector} { opacity: ${progress}; transform: scale(${scale}); transform-origin: center center; }`,
    )
  }

  // New edges: draw with evolvePath
  for (const edgeRef of newEdges) {
    const edge = edgeMap.get(edgeRef.edgeId)
    if (!edge) continue
    try {
      if (edge.pathD) {
        const evolved = evolvePath(progress, edge.pathD)
        styles.push(
          `${edge.pathSelector} { stroke-dasharray: ${evolved.strokeDasharray}; stroke-dashoffset: ${evolved.strokeDashoffset}; }`,
        )
      }
    } catch {
      styles.push(`${edge.pathSelector} { opacity: ${progress}; }`)
    }
  }

  // Highlight nodes: pulse scale 1→1.05→1 + glow
  for (const nodeId of highlightIds) {
    const node = nodeMap.get(nodeId)
    if (!node) continue
    // Pulse animation: goes up then back down within the step
    const pulseProgress = interpolate(frame, [0, stepDuration / 2, stepDuration], [1, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    styles.push(
      `${node.selector} { opacity: 1; transform: scale(${pulseProgress}); transform-origin: center center; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)); }`,
    )
  }

  // Per-step style overrides
  for (const [nodeRef, overrides] of Object.entries(styleOverrides)) {
    const node = nodeMap.get(nodeRef)
    if (!node) continue
    const cssProps = Object.entries(overrides)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ")
    // Apply via CSS custom properties on the node's rect/polygon
    styles.push(`${node.selector} rect, ${node.selector} polygon, ${node.selector} circle { ${cssProps}; }`)
  }

  return (
    <>
      <style>{styles.join("\n")}</style>
      {/* Subtitle bar */}
      {label && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 40px",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "white",
            fontSize: 24,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: "center",
            opacity: Math.min(1, progress * 2),
            zIndex: 100,
          }}
        >
          {label}
        </div>
      )}
    </>
  )
}

function transitionProgress(
  frame: number,
  fps: number,
  transition: "spring" | "ease" | "linear",
): number {
  switch (transition) {
    case "spring":
      return spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 0.5 } })
    case "ease":
      // Ease-in-out over 0.5s
      const t = Math.min(1, frame / (fps * 0.5))
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case "linear":
      return Math.min(1, frame / (fps * 0.5))
  }
}
