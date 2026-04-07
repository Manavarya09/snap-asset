---
name: snap-asset
description: "Claude Code plugin to capture screenshots of web pages, components, and extract site assets as optimized PNG+WebP. Trigger: 'screenshot', 'capture', 'snap', 'grab screenshot', 'extract assets', 'component screenshot', or '/snap-asset'."
argument-hint: "<url-or-command> [options]"
allowed-tools: Bash, Read, Glob, Write
---

# snap-asset — Claude Code Plugin

A Claude Code skill that captures pixel-perfect screenshots and extracts site assets directly from your terminal. No more manual screenshot → rename → convert → move workflow.

## Setup

The plugin lives at `~/.claude/plugins/snap-asset/`. Claude Code auto-discovers the skill from the `skills/` directory.

```bash
# Install
git clone https://github.com/Manavarya09/snap-asset.git ~/.claude/plugins/snap-asset
cd ~/.claude/plugins/snap-asset && npm install
```

## Usage in Claude Code

Just ask Claude naturally:

- "Screenshot my app at localhost:5173 and save it as hero"
- "Capture the .feature-card element from my running app"
- "Extract all assets from https://competitor.com"
- "Take a screenshot of my Hero.tsx component in isolation"
- "Grab dark mode screenshots of my landing page"

Or use the slash command directly:

```
/snap-asset https://localhost:5173 --name hero --out public/
/snap-asset extract https://example.com --out public/assets
/snap-asset component ./src/components/Hero.tsx
```

## Commands

### Capture a URL
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" <url> --name <name> [options]
```

### Capture a specific element
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" <url> --selector "<css>" --name <name>
```

### Extract all assets from a website
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" extract <url> --out public/extracted
```
Captures: full page, viewport, sections (hero, header, footer, features, pricing), images, and component-like elements (cards, buttons, navbars).

### Capture a component in isolation
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" component ./src/components/Hero.tsx --name hero
```
Spins up a temporary Vite server, renders the component with transparent background, captures it, then cleans up.

### Batch capture from config
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" batch
```

### Initialize config
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" init
```

## Options
- `--name <name>` — output filename (auto-derived if omitted)
- `--out <dir>` — output directory (auto-detects public/ or assets/)
- `--selector <css>` — capture specific element
- `--width <px>` — viewport width (default: 1280)
- `--height <px>` — viewport height (default: 800)
- `--scale <n>` — device scale (default: 2 for retina)
- `--format <fmt>` — png, webp, or both (default: both)
- `--quality <n>` — WebP quality 1-100 (default: 80)
- `--dark` — dark color scheme
- `--full-page` — capture full scrollable page
- `--wait <ms>` — wait before capture (for animations)

## Workflow for Claude
1. Parse the user's request to identify: URL or component path, name, output dir, options
2. If user mentions "dark mode", add `--dark` flag
3. If user mentions a specific element, use `--selector`
4. If user wants everything from a site, use `extract` command
5. Run the snap-asset command via Bash
6. Report saved files, sizes, and WebP savings to the user
7. If user wants the assets in their code, help integrate image paths into components (e.g., `<img src="/hero.webp" />`)
