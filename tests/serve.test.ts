import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createHttpServer } from "../src/serve.js"
import type { Server } from "node:http"

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createHttpServer()
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`
      }
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })
})

describe("HTTP serve: GET /health", () => {
  it("returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.version).toBe("0.2.0")
  })
})

describe("HTTP serve: POST /render", () => {
  it("returns SVG for format=svg", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "graph TD; A-->B;", format: "svg" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/svg+xml")
    const text = await res.text()
    expect(text).toContain("<svg")
  })

  it("returns PNG with correct magic bytes", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "graph TD; A-->B;", format: "png" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // P
    expect(buf[2]).toBe(0x4e) // N
    expect(buf[3]).toBe(0x47) // G
  })

  it("returns PDF with correct magic bytes", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "graph TD; A-->B;", format: "pdf" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    const buf = Buffer.from(await res.arrayBuffer())
    expect(String.fromCharCode(buf[0], buf[1], buf[2], buf[3])).toBe("%PDF")
  })

  it("returns 400 for invalid diagram", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "not valid mermaid %%%", format: "svg" }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 400 for missing diagram field", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "svg" }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("diagram")
  })

  it("returns 400 for invalid format", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "graph TD; A-->B;", format: "gif" }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("gif")
  })

  it("returns 400 for invalid JSON body", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    })
    expect(res.status).toBe(400)
  })

  it("returns 405 for GET on /render", async () => {
    const res = await fetch(`${baseUrl}/render`)
    expect(res.status).toBe(405)
  })

  it("defaults to svg format when none specified", async () => {
    const res = await fetch(`${baseUrl}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagram: "graph TD; A-->B;" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/svg+xml")
  })
})

describe("HTTP serve: 404", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/unknown`)
    expect(res.status).toBe(404)
  })
})
