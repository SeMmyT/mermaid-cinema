import { defineBuildConfig } from "unbuild"

export default defineBuildConfig({
  entries: [
    { input: "src/index", name: "index" },
    { input: "src/cli", name: "cli" },
    { input: "src/animation/index", name: "animation/index" },
  ],
  declaration: true,
  rollup: {
    emitCJS: false,
  },
})
