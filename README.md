# mermaid-cinema

Mermaid diagrams to SVG, PNG, PDF, GIF, MP4. No browser required for static output. Animated diagrams with Remotion.

## Install

```bash
npm install -g mermaid-cinema
# or use directly
npx mermaid-cinema render diagram.mmd -o diagram.png
```

### Animation support (optional)

```bash
npm install remotion @remotion/cli @remotion/renderer @remotion/paths react react-dom
```

## Usage

### Static output (no browser)

```bash
# SVG (fastest — ~50ms)
mermaid-cinema render diagram.mmd -o diagram.svg

# PNG (2x scale by default)
mermaid-cinema render diagram.mmd -o diagram.png

# PDF
mermaid-cinema render diagram.mmd -o diagram.pdf

# Dark theme
mermaid-cinema render diagram.mmd -o diagram.png --theme dark

# From stdin
echo "graph TD; A-->B;" | mermaid-cinema render -o diagram.svg
```

### Animated output (requires Remotion)

```bash
# Animated GIF — progressive node/edge reveal
mermaid-cinema render diagram.mmd -o diagram.gif

# MP4 video
mermaid-cinema render diagram.mmd -o diagram.mp4

# ByteByteGo-style flowing edges
mermaid-cinema render diagram.mmd -o diagram.gif --animate flow

# Custom duration and FPS
mermaid-cinema render diagram.mmd -o diagram.mp4 --duration 10 --fps 60
```

### Inspect node IDs

```bash
mermaid-cinema inspect diagram.mmd
# Diagram type: flowchart-v2
# Nodes (3):
#   flowchart-A-0 → "Client"
#   flowchart-B-1 → "Server"
#   flowchart-C-3 → "Database"
# Edges (2):
#   A → B
#   B → C
```

## Animation modes

| Mode | Flag | What it does |
|------|------|-------------|
| **reveal** | `--animate reveal` | Nodes fade in, edges draw progressively. Topological order. Default for GIF/MP4. |
| **flow** | `--animate flow` | All elements visible, edges have animated flowing dashes (ByteByteGo style). Loops. |
| **none** | `--animate none` | Static output. Default for SVG/PNG/PDF. |

Duration auto-calculated: `1 + (nodes x 0.5) + (edges x 0.3)` seconds, capped at 30s. Override with `--duration`.

## Programmatic API

```ts
import { renderMermaid, svgToPng } from "mermaid-cinema"

const svg = await renderMermaid("graph TD; A-->B;", { theme: "dark" })
const png = await svgToPng(svg, { scale: 2 })
```

## Why not mmdc?

| | mermaid-cinema | mmdc |
|---|---|---|
| Browser required | No (static) / Optional (animation) | Always (Puppeteer) |
| Cold start | ~50ms | ~2000ms |
| Animated GIF/MP4 | Yes | No |
| SVG works in Inkscape | Yes (resvg) | No (Chromium artifacts) |
| CrowdStrike safe | Yes | No |
| Docker friendly | Yes | Needs --no-sandbox |

## Supported diagram types

Flowchart, Sequence, Class, State, ER, Pie, Gantt. More coming.

## License

MIT (core). Animation features use [Remotion](https://remotion.dev) which has its own [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
