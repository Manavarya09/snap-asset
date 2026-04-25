Title: Improve error reporting for `loginScript` failures in `captureUrl`

Problem:
- `src/capturer.js` catches and swallows errors from `loginScript`, making debugging auth flows hard.

Proposal:
- Add verbose logging or an option to surface loginScript errors when `--verbose` is set.
- Add tests and docs showing how to author `loginScript` modules.

Files: `src/capturer.js`, `bin/snap-asset.js`, `README.md`
