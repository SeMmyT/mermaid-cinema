# mermaid-cinema

Mermaid diagrams → SVG, PNG, PDF. No browser required. 40x faster than mmdc.

## Install

```bash
npm install -g mermaid-cinema
# or use directly
npx mermaid-cinema render diagram.mmd -o diagram.png
```

## Usage

```bash
# SVG (fastest)
mermaid-cinema render diagram.mmd -o diagram.svg

# PNG (2x scale by default)
mermaid-cinema render diagram.mmd -o diagram.png

# PDF
mermaid-cinema render diagram.mmd -o diagram.pdf

# Dark theme
mermaid-cinema render diagram.mmd -o diagram.png --theme dark

# From stdin
echo "graph TD; A-->B;" | mermaid-cinema render -o diagram.svg

# Inspect node IDs (for animation steps)
mermaid-cinema inspect diagram.mmd
```

## Programmatic API

```ts
import { renderMermaid, svgToPng } from "mermaid-cinema"

const svg = await renderMermaid("graph TD; A-->B;", { theme: "dark" })
const png = await svgToPng(svg, { scale: 2 })
```

## Why not mmdc?

| | mermaid-cinema | mmdc |
|---|---|---|
| Browser required | No | Yes (Puppeteer) |
| Cold start | ~50ms | ~2000ms |
| SVG works in Inkscape | Yes (resvg) | No (Chromium artifacts) |
| CrowdStrike safe | Yes | No |
| Docker friendly | Yes | Needs --no-sandbox |

## License

MIT
