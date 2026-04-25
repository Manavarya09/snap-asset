Title: Expand uploader docs and add unit tests for mock/local uploaders

Problem:
- Uploaders are dynamically imported and integration tests are guarded; developers could benefit from thorough mock/local tests and docs.

Proposal:
- Add unit tests that exercise `getUploader()` with `mock` and `local` types.
- Improve README with uploader examples and troubleshooting.

Files: `src/uploader.js`, `src/uploaders/*`, `tests/`
