// src/export-png.ts
import { Resvg } from "@resvg/resvg-js"

export interface PngOptions {
  scale?: number
  backgroundColor?: string
}

/**
 * Sanitize mermaid SVG for resvg:
 * 1. Replace width="100%" with pixel value from viewBox
 * 2. Fix invalid transform values (undefined, NaN)
 * 3. Remove foreignObject elements (not supported by resvg)
 * 4. Recalculate viewBox to cover actual content
 */
function sanitizeSvg(svg: string): string {
  let s = svg

  // Remove foreignObject elements entirely — resvg doesn't support them
  // and mermaid uses them for HTML-based labels
  s = s.replace(/<foreignObject[^>]*>[\s\S]*?<\/foreignObject>/gi, "")

  // Fix invalid transform attributes: translate(undefined, NaN), etc.
  s = s.replace(/transform="[^"]*(?:undefined|NaN)[^"]*"/g, 'transform="translate(0, 0)"')

  // Fix any remaining NaN or undefined in numeric attributes
  s = s.replace(/="NaN"/g, '="0"')
  s = s.replace(/="undefined"/g, '="0"')

  // Extract viewBox
  const viewBoxMatch = s.match(/viewBox="([^"]*)"/)
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number)
    if (parts.length === 4) {
      let [minX, minY, vbWidth, vbHeight] = parts

      // Ensure minimum dimensions
      if (vbWidth <= 0) vbWidth = 800
      if (vbHeight <= 0) vbHeight = 600

      // Scan for translate transforms to find actual content bounds
      const translatePattern = /translate\(([^,)]+),?\s*([^)]*)\)/g
      let maxX = minX + vbWidth
      let maxY = minY + vbHeight
      let match
      while ((match = translatePattern.exec(s)) !== null) {
        const tx = parseFloat(match[1])
        const ty = parseFloat(match[2] || "0")
        if (!isNaN(tx) && !isNaN(ty)) {
          maxX = Math.max(maxX, tx + 100) // +100 for element size
          maxY = Math.max(maxY, ty + 100)
        }
      }

      // Update viewBox to cover all content
      const newWidth = Math.max(vbWidth, maxX - minX)
      const newHeight = Math.max(vbHeight, maxY - minY)

      s = s.replace(viewBoxMatch[0], `viewBox="${minX} ${minY} ${newWidth} ${newHeight}"`)

      // Replace percentage or missing width/height with actual pixel values
      s = s.replace(/width="100%"/, `width="${newWidth}"`)
      if (!s.match(/<svg[^>]*height="\d/)) {
        s = s.replace(/<svg /, `<svg height="${newHeight}" `)
      }

      // Fix max-width in style
      s = s.replace(/max-width:\s*[\d.]+px/, `max-width: ${newWidth}px`)
    }
  }

  return s
}

export async function svgToPng(
  svg: string,
  opts: PngOptions = {},
): Promise<Buffer> {
  const scale = opts.scale ?? 2
  const sanitizedSvg = sanitizeSvg(svg)

  const resvg = new Resvg(sanitizedSvg, {
    fitTo: { mode: "zoom", value: scale },
    background: opts.backgroundColor,
    font: {
      loadSystemFonts: true,
    },
  })

  const rendered = resvg.render()
  return Buffer.from(rendered.asPng())
}
