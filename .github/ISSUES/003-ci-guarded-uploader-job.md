Title: Add guarded CI job to run uploader integration tests when secrets present

Problem:
- Uploader integration tests are skipped by default; we should run them automatically in CI when secrets are configured.

Proposal:
- Add a guarded GitHub Actions job that sets `RUN_UPLOADER_INTEGRATION=1` only when required secrets exist.
- Document required secrets in README.

Files: `.github/workflows/ci.yml`, `README.md`
