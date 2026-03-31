import { describe, it, expect } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createMcpServer } from "../src/mcp/server.js"
import { existsSync, readFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

function createConnectedPair() {
  const server = createMcpServer()
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test-client", version: "0.0.1" })
  return { server, client, clientTransport, serverTransport }
}

describe("MCP server", () => {
  it("can be instantiated", () => {
    const server = createMcpServer()
    expect(server).toBeDefined()
  })

  it("lists render_diagram and inspect_diagram tools", async () => {
    const { server, client, clientTransport, serverTransport } = createConnectedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain("render_diagram")
    expect(names).toContain("inspect_diagram")

    await client.close()
    await server.close()
  })

  it("render_diagram produces a PNG file", async () => {
    const { server, client, clientTransport, serverTransport } = createConnectedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const dir = tmpdir()
    const result = await client.callTool({
      name: "render_diagram",
      arguments: {
        diagram: "graph TD; A-->B;",
        format: "png",
        outputDir: dir,
      },
    })

    expect(result.isError).toBeFalsy()
    const content = result.content as Array<{ type: string; text: string }>
    const parsed = JSON.parse(content[0].text)
    expect(parsed.outputPath).toBeDefined()
    expect(parsed.format).toBe("png")
    expect(existsSync(parsed.outputPath)).toBe(true)

    // Check PNG magic bytes
    const buf = readFileSync(parsed.outputPath)
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)

    unlinkSync(parsed.outputPath)
    await client.close()
    await server.close()
  })

  it("render_diagram produces an SVG file", async () => {
    const { server, client, clientTransport, serverTransport } = createConnectedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const dir = tmpdir()
    const result = await client.callTool({
      name: "render_diagram",
      arguments: {
        diagram: "graph TD; A-->B;",
        format: "svg",
        outputDir: dir,
      },
    })

    expect(result.isError).toBeFalsy()
    const content = result.content as Array<{ type: string; text: string }>
    const parsed = JSON.parse(content[0].text)
    const svg = readFileSync(parsed.outputPath, "utf-8")
    expect(svg).toContain("<svg")

    unlinkSync(parsed.outputPath)
    await client.close()
    await server.close()
  })

  it("inspect_diagram returns correct structure", async () => {
    const { server, client, clientTransport, serverTransport } = createConnectedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const result = await client.callTool({
      name: "inspect_diagram",
      arguments: {
        diagram: "graph TD; A[Browser]-->B[Server]; B-->C[Database]",
      },
    })

    expect(result.isError).toBeFalsy()
    const content = result.content as Array<{ type: string; text: string }>
    const info = JSON.parse(content[0].text)

    expect(info.nodes).toBeDefined()
    expect(info.edges).toBeDefined()
    expect(info.diagramType).toBeDefined()
    expect(info.svgWidth).toBeDefined()
    expect(info.svgHeight).toBeDefined()
    expect(info.nodes.length).toBeGreaterThanOrEqual(3)
    expect(info.edges.length).toBeGreaterThanOrEqual(2)

    await client.close()
    await server.close()
  })

  it("render_diagram returns error for invalid diagram", async () => {
    const { server, client, clientTransport, serverTransport } = createConnectedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const result = await client.callTool({
      name: "render_diagram",
      arguments: {
        diagram: "not valid mermaid %%%",
        format: "png",
      },
    })

    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type: string; text: string }>
    expect(content[0].text).toContain("Error")

    await client.close()
    await server.close()
  })
})
