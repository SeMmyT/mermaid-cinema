// src/steps/parse-steps.ts
import yaml from "js-yaml"
import type { DiagramInfo, EdgeInfo } from "../inspect.js"

// ─── Types ───

export interface StepDef {
  show?: string[]
  connect?: string[]
  highlight?: string[]
  label?: string
  style?: Record<string, Record<string, string>>
}

export interface StepsConfig {
  title?: string
  fps: number
  duration: "auto" | number
  transition: "spring" | "ease" | "linear"
  steps: StepDef[]
}

export interface ResolvedStep {
  /** Resolved node IDs (data-mc-id format won't be used here — these are diagram node IDs) */
  showNodeIds: string[]
  /** Resolved edge pairs as [sourceId, targetId] */
  connectEdges: Array<{ source: string; target: string; edgeId: string }>
  /** Resolved highlight node IDs */
  highlightNodeIds: string[]
  label: string
  style: Record<string, Record<string, string>>
}

export interface ResolvedSteps {
  config: StepsConfig
  steps: ResolvedStep[]
}

export class StepsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StepsValidationError"
  }
}

// ─── Parser ───

/**
 * Parse a steps.yaml string into a StepsConfig.
 * Validates structure but does NOT validate node/edge references against a diagram.
 */
export function parseSteps(yamlStr: string): StepsConfig {
  const raw = yaml.load(yamlStr) as Record<string, unknown>
  if (!raw || typeof raw !== "object") {
    throw new StepsValidationError("Steps file must be a YAML object")
  }

  const fps = typeof raw.fps === "number" ? raw.fps : 30
  const duration =
    raw.duration === "auto" || raw.duration === undefined
      ? "auto"
      : typeof raw.duration === "number"
        ? raw.duration
        : "auto"
  const transition = validateTransition(raw.transition as string | undefined)
  const title = typeof raw.title === "string" ? raw.title : undefined

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new StepsValidationError("Steps file must contain at least 1 step")
  }

  const steps: StepDef[] = raw.steps.map((s: unknown, i: number) => {
    if (!s || typeof s !== "object") {
      throw new StepsValidationError(`Step ${i + 1}: must be an object`)
    }
    const step = s as Record<string, unknown>
    const show = toStringArray(step.show)
    const connect = toStringArray(step.connect)
    const highlight = toStringArray(step.highlight)
    const label = typeof step.label === "string" ? step.label : ""
    const style = parseStyleOverrides(step.style)

    if (!show.length && !connect.length && !highlight.length) {
      throw new StepsValidationError(
        `Step ${i + 1}: must have at least one of: show, connect, highlight`,
      )
    }

    return { show, connect, highlight, label, style }
  })

  return { title, fps, duration, transition, steps }
}

// ─── Validator / Resolver ───

/**
 * Validate step references against a real diagram and resolve to concrete IDs.
 * Matches by ID first, then by label text (case-insensitive).
 */
export function resolveSteps(
  config: StepsConfig,
  diagram: DiagramInfo,
): ResolvedSteps {
  const resolved: ResolvedStep[] = config.steps.map((step, i) => {
    const showNodeIds = (step.show ?? []).map((ref) =>
      resolveNodeRef(ref, diagram, i + 1),
    )

    const connectEdges = (step.connect ?? []).map((ref) =>
      resolveEdgeRef(ref, diagram, i + 1),
    )

    const highlightNodeIds = (step.highlight ?? []).map((ref) =>
      resolveNodeRef(ref, diagram, i + 1),
    )

    // Validate style keys reference real nodes
    const style = step.style ?? {}
    for (const key of Object.keys(style)) {
      resolveNodeRef(key, diagram, i + 1)
    }

    return {
      showNodeIds,
      connectEdges,
      highlightNodeIds,
      label: step.label ?? "",
      style,
    }
  })

  return { config, steps: resolved }
}

// ─── Helpers ───

function validateTransition(t: string | undefined): "spring" | "ease" | "linear" {
  if (!t) return "spring"
  if (t === "spring" || t === "ease" || t === "linear") return t
  throw new StepsValidationError(
    `Invalid transition "${t}". Must be: spring, ease, linear`,
  )
}

function toStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  return [String(val)]
}

function parseStyleOverrides(
  val: unknown,
): Record<string, Record<string, string>> {
  if (!val || typeof val !== "object") return {}
  const result: Record<string, Record<string, string>> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      result[k] = {}
      for (const [prop, propVal] of Object.entries(v as Record<string, unknown>)) {
        result[k][prop] = String(propVal)
      }
    }
  }
  return result
}

/**
 * Resolve a node reference string to a diagram node ID.
 * Tries exact ID match first, then case-insensitive label match.
 */
function resolveNodeRef(
  ref: string,
  diagram: DiagramInfo,
  stepNum: number,
): string {
  // 1. Exact ID match
  const byId = diagram.nodes.find((n) => n.id === ref)
  if (byId) return byId.id

  // 2. Case-insensitive label match
  const refLower = ref.toLowerCase()
  const byLabel = diagram.nodes.find(
    (n) => n.label.toLowerCase() === refLower,
  )
  if (byLabel) return byLabel.id

  // 3. Fuzzy: label contains ref (case-insensitive)
  const byFuzzy = diagram.nodes.find((n) =>
    n.label.toLowerCase().includes(refLower),
  )
  if (byFuzzy) return byFuzzy.id

  // 4. Fuzzy: ref contains label
  const byReverse = diagram.nodes.find((n) =>
    refLower.includes(n.label.toLowerCase()),
  )
  if (byReverse) return byReverse.id

  throw new StepsValidationError(
    `Step ${stepNum}: node "${ref}" not found in diagram. Available nodes: ${diagram.nodes.map((n) => `${n.id} ("${n.label}")`).join(", ")}`,
  )
}

/**
 * Extract the short Mermaid ID from a full node ID.
 * e.g. "flowchart-A-0" → "A", "flowchart-Browser-1" → "Browser"
 * Pattern: "prefix-SHORTID-index" where prefix is the diagram type.
 */
function extractShortId(nodeId: string): string {
  // Try the common "diagramType-shortId-index" pattern
  const match = nodeId.match(/^[a-zA-Z]+-(.+?)-\d+$/)
  if (match) return match[1]
  return nodeId
}

/**
 * Find an edge in the diagram matching the given source and target node IDs.
 * Handles the mismatch between full node IDs (flowchart-A-0) and edge
 * source/target short IDs (A, B) from inspectSvg.
 */
function findEdge(
  sourceNodeId: string,
  targetNodeId: string,
  diagram: DiagramInfo,
): EdgeInfo | undefined {
  // Strategy 1: exact match
  const exact = diagram.edges.find(
    (e) => e.source === sourceNodeId && e.target === targetNodeId,
  )
  if (exact) return exact

  // Strategy 2: match by short IDs extracted from full node IDs
  const sourceShort = extractShortId(sourceNodeId)
  const targetShort = extractShortId(targetNodeId)

  const byShort = diagram.edges.find(
    (e) => e.source === sourceShort && e.target === targetShort,
  )
  if (byShort) return byShort

  // Strategy 3: either source or target matches (for mangled IDs)
  const partial = diagram.edges.find(
    (e) =>
      (e.source === sourceShort || e.source === sourceNodeId) &&
      (e.target === targetShort || e.target === targetNodeId),
  )
  if (partial) return partial

  return undefined
}

/**
 * Resolve an edge reference like "Browser-->AuthServer" to diagram edge info.
 * The format is "source-->target" where source/target are node refs.
 */
function resolveEdgeRef(
  ref: string,
  diagram: DiagramInfo,
  stepNum: number,
): { source: string; target: string; edgeId: string } {
  // Parse "Source-->Target" format
  const arrowMatch = ref.match(/^(.+?)-->(.+)$/)
  if (!arrowMatch) {
    throw new StepsValidationError(
      `Step ${stepNum}: invalid edge format "${ref}". Expected "Source-->Target"`,
    )
  }

  const sourceRef = arrowMatch[1].trim()
  const targetRef = arrowMatch[2].trim()

  const sourceId = resolveNodeRef(sourceRef, diagram, stepNum)
  const targetId = resolveNodeRef(targetRef, diagram, stepNum)

  // Find matching edge in diagram.
  // Mermaid node IDs are like "flowchart-A-0" but edge source/target from
  // inspectSvg are the short IDs "A", "B". We need to try multiple matching strategies.
  const edge = findEdge(sourceId, targetId, diagram)

  if (!edge) {
    throw new StepsValidationError(
      `Step ${stepNum}: edge "${ref}" (${sourceId} → ${targetId}) not found in diagram. Available edges: ${diagram.edges.map((e) => `${e.source}→${e.target}`).join(", ")}`,
    )
  }

  return { source: sourceId, target: targetId, edgeId: edge.id }
}
