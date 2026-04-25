Title: Add Windows CI compatibility checks and docs

Problem:
- Playwright and `sharp` sometimes need special handling on Windows (binaries and permissions).

Proposal:
- Add a lightweight Windows job in CI that verifies installation and runs a subset of tests.
- Document any Windows-specific setup in README.

Files: `.github/workflows`, `README.md`
