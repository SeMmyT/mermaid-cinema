import { defineBuildConfig } from "unbuild"

export default defineBuildConfig({
  entries: [
    { input: "src/index", name: "index" },
    { input: "src/cli", name: "cli" },
    { input: "src/animation/index", name: "animation/index" },
    { input: "src/steps/parse-steps", name: "steps/parse-steps" },
    { input: "src/export-asvg", name: "export-asvg" },
    { input: "src/mcp/server", name: "mcp/server" },
    { input: "src/serve", name: "serve" },
  ],
  declaration: true,
  rollup: {
    emitCJS: false,
  },
})
