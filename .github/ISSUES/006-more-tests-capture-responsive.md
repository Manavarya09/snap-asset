Title: Add unit/integration tests for `captureResponsive` and `extractSiteAssets` edge cases

Problem:
- `src/capturer.js` implements `captureResponsive` and `extractSiteAssets` but tests are limited.

Proposal:
- Add tests for various widths, missing selectors, pages with lazy images, and error paths (timeouts, failed downloads).
- Mock Playwright contexts where feasible.

Files: `tests/`, `src/capturer.js`
