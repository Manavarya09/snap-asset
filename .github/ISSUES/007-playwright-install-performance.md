Title: Speed up Playwright browser install in CI

Problem:
- `postinstall` currently runs Playwright install which slows CI runs.

Proposal:
- Cache Playwright browsers in CI and/or make postinstall conditional in CI; document best practices.
- Consider `playwright install --with-deps` only for native CI runners where needed.

Files: `package.json`, `.github/workflows/ci.yml`
