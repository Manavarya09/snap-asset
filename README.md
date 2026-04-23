<p align="center">
  <img src="https://img.shields.io/badge/snap--asset-v0.1.0-FF6B35?style=for-the-badge&logo=camera&logoColor=white" alt="snap-asset" />
</p>

<h1 align="center">snap-asset</h1>

<p align="center">
  <strong>A Claude Code plugin that captures screenshots and extracts site assets.</strong><br/>
  Just tell Claude "screenshot my app" — it handles capture, optimization, and placement.
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Features-5+-blue?style=flat-square" alt="Features" /></a>
  <a href="#install"><img src="https://img.shields.io/badge/node-%3E%3D20-43853D?style=flat-square&logo=node.js&logoColor=white" alt="Node >= 20" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Sharp-PNG%20%2B%20WebP-99CC00?style=flat-square&logo=sharp&logoColor=white" alt="Sharp" />
  <img src="https://img.shields.io/badge/Claude%20Code-Skill-blueviolet?style=flat-square" alt="Claude Code Skill" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-Supported-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vue-Supported-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue" />
  <img src="https://img.shields.io/badge/Svelte-Supported-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte" />
</p>

---

## The Problem

Building a portfolio? Showcasing app features? You've done this dance:

1. Open your app in the browser
2. Manually take a screenshot
3. Rename it something sensible
4. Convert to WebP for performance
5. Move to `public/` or `assets/`
6. Repeat 20 times

**snap-asset is a Claude Code plugin that automates the entire pipeline.** Tell Claude what to capture — it handles the rest. Also works standalone as a CLI.

---

## Install as Claude Code Plugin

```bash
git clone https://github.com/Manavarya09/snap-asset.git ~/.claude/plugins/snap-asset
cd ~/.claude/plugins/snap-asset && npm install
```

Then just talk to Claude naturally:

> "Screenshot my app at localhost:5173 and save it as hero"

> "Extract all assets from https://competitor.com into public/"

> "Capture the .feature-card element in dark mode"

> "Take a screenshot of my Hero.tsx component in isolation"

Or use `/snap-asset` as a slash command.

---

## Features

- **Claude Code Skill** — Just describe what you want, Claude captures it
- **URL Capture** — Screenshot any URL with Playwright's headless Chromium
- **Element Capture** — Target specific elements with CSS selectors
- **Site Extraction** — Scrape an entire website: sections, images, components, everything
- **Component Isolation** — Render React/Vue/Svelte components in isolation and capture
- **Batch Mode** — Define all your captures in a config file, run once
- **Auto-Optimization** — PNG + WebP generated simultaneously via Sharp
- **Retina Ready** — 2x device scale by default for crisp screenshots
- **Dark Mode** — Capture in light or dark color scheme
- **Claude Code Skill** — Use as `/snap-asset` inside Claude Code

---

## Install

```bash
# Clone into your plugins directory
git clone https://github.com/Manavarya09/snap-asset.git
cd snap-asset
npm install

# Or use directly with npx (after global install)
npm install -g .
```

> Playwright will automatically download Chromium during `npm install`.
>
> Run `npm test` to execute the built-in output and optimizer test suite.
>
> Component isolation uses Vite and framework plugins. Those dependencies are included in the package so component rendering works out of the box.

---

## Quick Start

### Capture a URL

```bash
snap-asset https://myapp.com --name hero --out public/
```

```
  snap-asset v0.1.0

  URL          https://myapp.com
  Viewport     1280x800 @2x

  saved  public/hero.png   (142 KB)
  saved  public/hero.webp  ( 68 KB)
  WebP saved 52% vs PNG

  ✓ Done!
```

### Capture a Specific Element

```bash
snap-asset https://myapp.com --selector ".feature-card" --name feature
```

### Extract Everything from a Website

```bash
snap-asset extract https://myapp.com --out public/assets
```

This grabs:
- Full page screenshot
- Viewport (above-the-fold) screenshot
- Sections: hero, header, footer, features, pricing, testimonials, CTA
- All images (>50px, auto-named from alt text)
- Components: cards, buttons, navbars, modals, sidebars

### Capture a Component in Isolation

```bash
snap-asset component ./src/components/Hero.tsx --name hero
```

Spins up a temporary Vite server, renders your component, captures it with transparent background.

### Batch Mode

```bash
# Generate starter config
snap-asset init

# Edit snap-asset.config.json, then:
snap-asset batch
```

---

## CLI Reference

```
Usage: snap-asset [options] [command] [url]

Commands:
  extract <url>          Extract all assets from a website
  component <path>       Capture a component in isolation
  batch                  Run captures from snap-asset.config.json
  init                   Generate starter config

Options:
  -n, --name <name>      Output filename (auto-derived if omitted)
  -o, --out <dir>        Output directory (auto-detects public/)
  -s, --selector <css>   Capture a specific element
  -w, --width <px>       Viewport width (default: 1280)
  -h, --height <px>      Viewport height (default: 800)
  --scale <n>            Device scale factor (default: 2)
  -f, --format <fmt>     png, webp, or both (default: both)
  -q, --quality <n>      WebP quality 1-100 (default: 80)
  --resize <WxH>         Resize after capture
  --wait <ms>            Wait before capture (for animations)
  --dark                 Dark color scheme
  --full-page            Capture full scrollable page
  --overwrite            Overwrite existing files
```

---

## Config File

`snap-asset.config.json`:

```json
{
  "defaults": {
    "out": "public/screenshots",
    "width": 1280,
    "height": 800,
    "scale": 2,
    "format": "both",
    "quality": 80
  },
  "captures": [
    {
      "name": "hero",
      "url": "http://localhost:5173",
      "selector": ".hero-section"
    },
    {
      "name": "dashboard",
      "url": "http://localhost:5173/dashboard",
      "fullPage": true
    },
    {
      "name": "feature-card",
      "component": "./src/components/FeatureCard.tsx",
      "width": 400,
      "height": 300
    }
  ]
}
```

---

## Claude Code Integration

Use as a Claude Code skill:

```
/snap-asset https://myapp.com --name hero
/snap-asset extract https://competitor.com --out public/extracted
/snap-asset component ./src/Hero.tsx
```

Claude will capture, optimize, and save the assets — then help you integrate the image paths into your components.

---

## How It Works

```
URL / Component Path
        │
        ▼
  ┌─────────────┐
  │  Playwright  │  Headless Chromium
  │  Capture     │  Retina (2x), dark mode, selectors
  └──────┬──────┘
         │ Raw PNG buffer
         ▼
  ┌─────────────┐
  │    Sharp     │  Optimize PNG, convert to WebP
  │  Optimize    │  Auto-resize, quality control
  └──────┬──────┘
         │ Optimized buffers
         ▼
  ┌─────────────┐
  │   Output     │  Auto-detect public/ or assets/
  │   Manager    │  Safe naming, dedup, save
  └─────────────┘
```

---

## Use Cases

| Scenario | Command |
|---|---|
| Portfolio hero image | `snap-asset https://myapp.com --name hero` |
| Feature showcase cards | `snap-asset https://myapp.com --selector ".card" --name feature` |
| Competitor analysis | `snap-asset extract https://competitor.com` |
| Component library docs | `snap-asset component ./src/Button.tsx` |
| Landing page assets | `snap-asset batch` with config |
| Dark mode variant | `snap-asset https://myapp.com --dark --name hero-dark` |
| Mobile screenshot | `snap-asset https://myapp.com --width 375 --height 812 --name mobile` |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [Playwright](https://playwright.dev) | Headless browser automation |
| [Sharp](https://sharp.pixelplumbing.com) | High-performance image processing |
| [Commander](https://github.com/tj/commander.js) | CLI argument parsing |
| [Chalk](https://github.com/chalk/chalk) | Terminal colors |
| [Ora](https://github.com/sindresorhus/ora) | Terminal spinners |

---

## Contributing

PRs welcome! Check the [issues](https://github.com/Manavarya09/snap-asset/issues) for planned features.

```bash
git clone https://github.com/Manavarya09/snap-asset.git
cd snap-asset
npm install
node bin/snap-asset.js https://example.com --name test
```

---

## License

MIT - [Manav Arya Singh](https://github.com/Manavarya09)
