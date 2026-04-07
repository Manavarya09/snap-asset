---
name: snap-asset
description: "Capture screenshots of web pages, components, and extract site assets as optimized PNG+WebP. Use when user says 'screenshot', 'capture', 'snap asset', 'extract assets', 'grab screenshots', 'component screenshot', or '/snap-asset'."
argument-hint: "<url-or-command> [options]"
allowed-tools: Bash, Read, Glob, Write
---

# snap-asset

Capture web screenshots and extract site assets as optimized PNG+WebP images.

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
This will capture: full page, viewport, sections (hero, header, footer, features, pricing, etc.), images, and component-like elements (cards, buttons, navbars).

### Capture a component in isolation
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" component ./src/components/Hero.tsx --name hero
```

### Batch capture from config
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" batch
```

### Initialize config
```bash
node "${CLAUDE_SKILL_DIR}/../../bin/snap-asset.js" init
```

## Options
- `--name <name>` - output filename (auto-derived if omitted)
- `--out <dir>` - output directory (auto-detects public/ or assets/)
- `--selector <css>` - capture specific element
- `--width <px>` - viewport width (default: 1280)
- `--height <px>` - viewport height (default: 800)
- `--scale <n>` - device scale (default: 2 for retina)
- `--format <fmt>` - png, webp, or both (default: both)
- `--quality <n>` - WebP quality 1-100 (default: 80)
- `--dark` - dark mode
- `--full-page` - capture full scrollable page
- `--wait <ms>` - wait before capture

## Workflow
1. Parse the user's request to determine: URL/component, name, output dir, options
2. Run the appropriate snap-asset command via Bash
3. Report saved files and sizes to the user
4. If user wants extracted assets used in code, help integrate the image paths into their components
