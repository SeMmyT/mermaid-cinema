// src/export-png.ts
import { Resvg } from "@resvg/resvg-js"

export interface PngOptions {
  scale?: number
  backgroundColor?: string
}

/**
 * Ensure the SVG has explicit width/height attributes (not "100%").
 * Mermaid often outputs width="100%" with a viewBox — resvg needs pixel values.
 */
function normalizeSvgDimensions(svg: string): string {
  // Extract viewBox
  const viewBoxMatch = svg.match(/viewBox="([^"]*)"/)
  if (!viewBoxMatch) return svg

  const parts = viewBoxMatch[1].split(/\s+/).map(Number)
  if (parts.length !== 4) return svg

  const [, , vbWidth, vbHeight] = parts

  // Replace percentage or missing width/height with viewBox dimensions
  let result = svg
  if (svg.includes('width="100%"') || !svg.match(/width="\d/)) {
    result = result.replace(/width="100%"/, `width="${vbWidth}"`)
    if (!result.includes(`width="${vbWidth}"`)) {
      result = result.replace(/<svg /, `<svg width="${vbWidth}" `)
    }
  }
  if (!svg.match(/height="\d/)) {
    result = result.replace(/<svg /, `<svg height="${vbHeight}" `)
  }

  return result
}

export async function svgToPng(
  svg: string,
  opts: PngOptions = {},
): Promise<Buffer> {
  const scale = opts.scale ?? 2
  const normalizedSvg = normalizeSvgDimensions(svg)

  const resvg = new Resvg(normalizedSvg, {
    fitTo: { mode: "zoom", value: scale },
    background: opts.backgroundColor,
    font: {
      loadSystemFonts: true,
    },
  })

  const rendered = resvg.render()
  return Buffer.from(rendered.asPng())
}
