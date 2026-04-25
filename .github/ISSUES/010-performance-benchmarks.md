Title: Add performance benchmark harness for captures

Problem:
- No automated benchmarks to measure throughput, CPU, and memory for batch captures.

Proposal:
- Add a small benchmark script (`bench/`) to run N captures in parallel (configurable) and measure key metrics.
- Add CI job that runs benchmarks on demand and stores results as artifacts.

Files: `bench/`, `.github/workflows/bench.yml`
