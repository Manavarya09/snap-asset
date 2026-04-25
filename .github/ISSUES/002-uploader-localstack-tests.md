Title: Add localstack-backed uploader integration tests

Problem:
- `tests/uploader.integration.test.js` is guarded and requires cloud creds to exercise S3/GCS uploaders.

Proposal:
- Add a CI job that runs localstack (or use docker compose) to simulate S3 in CI for reliable integration tests.
- Add test harness that points S3 uploader to localstack endpoint.

Files: `tests/uploader.integration.test.js`, `src/uploaders/s3.js`, `.github/workflows`
