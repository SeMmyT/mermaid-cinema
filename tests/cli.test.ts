import { describe, it, expect } from "vitest"
import { execSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const CLI = "npx tsx src/cli.ts"
const CWD = join(import.meta.dirname, "..")

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "mc-test-"))
}

describe("CLI render", () => {
  it("renders .mmd file to .svg", () => {
    const dir = tmpDir()
    const input = join(dir, "test.mmd")
    const output = join(dir, "test.svg")
    writeFileSync(input, "graph TD; A-->B;")

    execSync(`${CLI} render ${input} -o ${output}`, { cwd: CWD })

    expect(existsSync(output)).toBe(true)
    const content = readFileSync(output, "utf-8")
    expect(content).toContain("<svg")
  })

  it("renders .mmd file to .png", () => {
    const dir = tmpDir()
    const input = join(dir, "test.mmd")
    const output = join(dir, "test.png")
    writeFileSync(input, "graph TD; A-->B;")

    execSync(`${CLI} render ${input} -o ${output}`, { cwd: CWD })

    expect(existsSync(output)).toBe(true)
    const buf = readFileSync(output)
    expect(buf[0]).toBe(0x89) // PNG magic
  })

  it("renders .mmd file to .pdf", () => {
    const dir = tmpDir()
    const input = join(dir, "test.mmd")
    const output = join(dir, "test.pdf")
    writeFileSync(input, "graph TD; A-->B;")

    execSync(`${CLI} render ${input} -o ${output}`, { cwd: CWD })

    expect(existsSync(output)).toBe(true)
    const content = readFileSync(output, "utf-8")
    expect(content.startsWith("%PDF")).toBe(true)
  })

  it("reads from stdin when no input file", () => {
    const dir = tmpDir()
    const output = join(dir, "test.svg")

    execSync(`echo "graph TD; A-->B;" | ${CLI} render -o ${output}`, {
      cwd: CWD,
      shell: "/bin/bash",
    })

    expect(existsSync(output)).toBe(true)
  })

  it("exits with error on invalid mermaid", () => {
    const dir = tmpDir()
    const input = join(dir, "bad.mmd")
    const output = join(dir, "bad.svg")
    writeFileSync(input, "not valid %%%")

    expect(() => {
      execSync(`${CLI} render ${input} -o ${output}`, {
        cwd: CWD,
        stdio: "pipe",
      })
    }).toThrow()
  })
})
