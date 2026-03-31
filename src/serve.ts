// src/serve.ts — HTTP server for mermaid-cinema rendering
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { renderMermaid } from "./render.js"
import { svgToPng } from "./export-png.js"
import { pngToPdf } from "./export-pdf.js"

export interface ServeOptions {
  port: number
  host?: string
}

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  pdf: "application/pdf",
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
}

function sendBinary(res: ServerResponse, status: number, contentType: string, data: Buffer | Uint8Array): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": data.length,
  })
  res.end(data)
}

async function handleRender(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed. Use POST." })
    return
  }

  let body: any
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw)
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" })
    return
  }

  const { diagram, format = "svg", theme = "default", scale = 2 } = body

  if (!diagram || typeof diagram !== "string") {
    sendJson(res, 400, { error: "Missing or invalid 'diagram' field" })
    return
  }

  const validFormats = ["svg", "png", "pdf"]
  if (!validFormats.includes(format)) {
    sendJson(res, 400, { error: `Invalid format "${format}". Use: ${validFormats.join(", ")}` })
    return
  }

  try {
    const svg = await renderMermaid(diagram, { theme })

    switch (format) {
      case "svg": {
        const buf = Buffer.from(svg, "utf-8")
        sendBinary(res, 200, CONTENT_TYPES.svg, buf)
        break
      }
      case "png": {
        const png = await svgToPng(svg, { scale })
        sendBinary(res, 200, CONTENT_TYPES.png, png)
        break
      }
      case "pdf": {
        const png = await svgToPng(svg, { scale })
        const pdf = await pngToPdf(png)
        sendBinary(res, 200, CONTENT_TYPES.pdf, Buffer.from(pdf))
        break
      }
    }
  } catch (err: any) {
    sendJson(res, 400, { error: `Render failed: ${err?.message ?? err}` })
  }
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { status: "ok", version: "0.2.0" })
}

export function createHttpServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

    if (url.pathname === "/health" && req.method === "GET") {
      handleHealth(req, res)
    } else if (url.pathname === "/render") {
      await handleRender(req, res)
    } else {
      sendJson(res, 404, { error: "Not found" })
    }
  })

  return server
}

export async function startHttpServer(opts: ServeOptions): Promise<void> {
  const server = createHttpServer()
  const host = opts.host ?? "127.0.0.1"

  return new Promise((resolve) => {
    server.listen(opts.port, host, () => {
      process.stderr.write(`mermaid-cinema HTTP server listening on http://${host}:${opts.port}\n`)
      process.stderr.write(`  POST /render   — render a diagram\n`)
      process.stderr.write(`  GET  /health   — health check\n`)
      resolve()
    })
  })
}
