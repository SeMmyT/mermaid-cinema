// src/mcp/server.ts — MCP server exposing mermaid-cinema rendering as tools
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomBytes } from "node:crypto"
import { renderMermaid } from "../render.js"
import { svgToPng } from "../export-png.js"
import { pngToPdf } from "../export-pdf.js"
import { inspectSvg } from "../inspect.js"

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "mermaid-cinema",
    version: "0.2.0",
  })

  server.tool(
    "render_diagram",
    "Render a Mermaid diagram to an image file",
    {
      diagram: z.string().describe("Mermaid diagram source code"),
      format: z
        .enum(["svg", "png", "pdf"])
        .default("png")
        .describe("Output format"),
      theme: z
        .enum(["default", "dark", "forest", "neutral"])
        .default("default")
        .describe("Diagram theme"),
      scale: z.number().default(2).describe("PNG scale factor"),
      outputDir: z
        .string()
        .optional()
        .describe("Directory to write output file. Defaults to OS temp dir."),
    },
    async ({ diagram, format, theme, scale, outputDir }) => {
      try {
        const svg = await renderMermaid(diagram, { theme })

        const dir = outputDir ?? tmpdir()
        const id = randomBytes(6).toString("hex")
        const filename = `mermaid-${id}.${format}`
        const outputPath = join(dir, filename)

        switch (format) {
          case "svg": {
            writeFileSync(outputPath, svg, "utf-8")
            break
          }
          case "png": {
            const png = await svgToPng(svg, { scale })
            writeFileSync(outputPath, png)
            break
          }
          case "pdf": {
            const png = await svgToPng(svg, { scale })
            const pdf = await pngToPdf(png)
            writeFileSync(outputPath, pdf)
            break
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ outputPath, format, theme, scale }),
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error rendering diagram: ${err?.message ?? err}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  server.tool(
    "inspect_diagram",
    "Inspect a Mermaid diagram to list node IDs, labels, and edges",
    {
      diagram: z.string().describe("Mermaid diagram source code"),
    },
    async ({ diagram }) => {
      try {
        const svg = await renderMermaid(diagram)
        const info = inspectSvg(svg)

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(info, null, 2),
            },
          ],
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error inspecting diagram: ${err?.message ?? err}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  return server
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
